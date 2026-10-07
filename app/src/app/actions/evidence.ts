"use server";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentUserLabel } from "@/lib/auth";
import { requireOrganizationPermission } from "@/lib/access-scope";
import {
  evidenceAbsolutePath,
  MAX_EVIDENCE_FILE_BYTES,
} from "@/lib/evidence-storage";
import { EvidenceType } from "../../../generated/prisma/client";

export async function uploadWorkOrderEvidence(
  workOrderId: string,
  formData: FormData
) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      assetId: true,
      organizationId: true,
      status: true,
      serviceRequest: {
        select: { organizationId: true },
      },
    },
  });

  const organizationId =
    workOrder?.organizationId ??
    workOrder?.serviceRequest?.organizationId;

  if (!workOrder || !organizationId) {
    throw new Error("Work order organization could not be resolved.");
  }

  const user = await requireOrganizationPermission(
    "evidence.upload",
    organizationId
  );

  const fileEntry = formData.get("file");
  const evidenceTypeRaw = String(
    formData.get("evidenceType") ?? ""
  ).trim();
  const description = String(
    formData.get("description") ?? ""
  ).trim();
  const capturedAtRaw = String(
    formData.get("capturedAt") ?? ""
  ).trim();

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    throw new Error("Evidence file is required.");
  }

  if (fileEntry.size > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error("Evidence file exceeds the 25 MB limit.");
  }

  const allowedTypes = new Set(Object.values(EvidenceType));

  if (!allowedTypes.has(evidenceTypeRaw as EvidenceType)) {
    throw new Error("Unsupported evidence type.");
  }

  let capturedAt: Date | null = null;

  if (capturedAtRaw) {
    const parsed = new Date(capturedAtRaw);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Captured-at timestamp is invalid.");
    }

    capturedAt = parsed;
  }

  const bytes = Buffer.from(await fileEntry.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = path.posix.join(
    organizationId,
    workOrder.id,
    randomUUID()
  );
  const absolutePath = evidenceAbsolutePath(storageKey);

  await mkdir(path.dirname(absolutePath), {
    recursive: true,
    mode: 0o750,
  });

  await writeFile(absolutePath, bytes, {
    flag: "wx",
    mode: 0o640,
  });

  try {
    await prisma.$transaction(async (tx) => {
      const event = await tx.workOrderEvent.create({
        data: {
          workOrderId: workOrder.id,
          actorUserId: user.id,
          actorLabel: currentUserLabel(user),
          eventType: "EVIDENCE_ADDED",
          fromStatus: workOrder.status,
          toStatus: workOrder.status,
          notes: [
            `Evidence type: ${evidenceTypeRaw}.`,
            description || null,
          ]
            .filter(Boolean)
            .join(" "),
        },
      });

      await tx.evidence.create({
        data: {
          organizationId,
          assetId: workOrder.assetId,
          workOrderId: workOrder.id,
          workOrderEventId: event.id,
          uploaderUserId: user.id,
          evidenceType: evidenceTypeRaw as EvidenceType,
          description: description || null,
          originalFilename: fileEntry.name || null,
          mimeType: fileEntry.type || "application/octet-stream",
          sizeBytes: fileEntry.size,
          storageKey,
          sha256,
          capturedAt,
          isOriginal: true,
        },
      });
    });
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }

  revalidatePath(`/work-orders/${workOrder.id}`);
}


const PACKAGE_EVIDENCE_TYPES = new Set<EvidenceType>([
  "PACKAGE_EXTERIOR",
  "SHIPPING_LABEL",
  "DAMAGE",
  "SERIAL_ASSET_TAG",
  "OTHER",
]);

export async function uploadPackageEvidence(
  packageId: string,
  formData: FormData
) {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      receipt: {
        select: { id: true },
      },
      shipment: {
        select: {
          serviceRequestId: true,
          serviceRequest: {
            select: {
              organizationId: true,
              assetId: true,
            },
          },
          workOrders: {
            select: {
              id: true,
              status: true,
            },
            orderBy: { openedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!pkg) {
    throw new Error("Package not found.");
  }

  const organizationId =
    pkg.shipment.serviceRequest.organizationId;
  const user = await requireOrganizationPermission(
    "evidence.upload",
    organizationId
  );

  const fileEntry = formData.get("file");
  const evidenceTypeRaw = String(
    formData.get("evidenceType") ?? ""
  ).trim();
  const description = String(
    formData.get("description") ?? ""
  ).trim();
  const capturedAtRaw = String(
    formData.get("capturedAt") ?? ""
  ).trim();

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    throw new Error("Evidence file is required.");
  }

  if (fileEntry.size > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error("Evidence file exceeds the 25 MB limit.");
  }

  const evidenceType = evidenceTypeRaw as EvidenceType;

  if (!PACKAGE_EVIDENCE_TYPES.has(evidenceType)) {
    throw new Error(
      "That evidence type is not valid for package receiving."
    );
  }

  let capturedAt: Date | null = null;

  if (capturedAtRaw) {
    const parsed = new Date(capturedAtRaw);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Captured-at timestamp is invalid.");
    }

    capturedAt = parsed;
  }

  const bytes = Buffer.from(await fileEntry.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = path.posix.join(
    organizationId,
    "packages",
    pkg.id,
    randomUUID()
  );
  const absolutePath = evidenceAbsolutePath(storageKey);

  await mkdir(path.dirname(absolutePath), {
    recursive: true,
    mode: 0o750,
  });

  await writeFile(absolutePath, bytes, {
    flag: "wx",
    mode: 0o640,
  });

  const workOrder = pkg.shipment.workOrders[0] ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      let workOrderEventId: string | null = null;

      if (workOrder) {
        const event = await tx.workOrderEvent.create({
          data: {
            workOrderId: workOrder.id,
            actorUserId: user.id,
            actorLabel: currentUserLabel(user),
            eventType: "EVIDENCE_ADDED",
            fromStatus: workOrder.status,
            toStatus: workOrder.status,
            notes: [
              `Package evidence type: ${evidenceTypeRaw}.`,
              description || null,
            ]
              .filter(Boolean)
              .join(" "),
          },
        });

        workOrderEventId = event.id;
      }

      await tx.evidence.create({
        data: {
          organizationId,
          assetId:
            pkg.shipment.serviceRequest.assetId ?? null,
          workOrderId: workOrder?.id ?? null,
          workOrderEventId,
          packageId: pkg.id,
          receiptId: pkg.receipt?.id ?? null,
          uploaderUserId: user.id,
          evidenceType,
          description: description || null,
          originalFilename: fileEntry.name || null,
          mimeType:
            fileEntry.type || "application/octet-stream",
          sizeBytes: fileEntry.size,
          storageKey,
          sha256,
          capturedAt,
          isOriginal: true,
        },
      });
    });
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }

  revalidatePath(
    `/service-requests/${pkg.shipment.serviceRequestId}`
  );

  if (workOrder) {
    revalidatePath(`/work-orders/${workOrder.id}`);
  }
}
