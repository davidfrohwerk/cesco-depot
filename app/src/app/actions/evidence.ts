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


const ASSET_EVIDENCE_TYPES = new Set<EvidenceType>([
  "SERIAL_ASSET_TAG",
  "DAMAGE",
  "TITLE_TRANSFER",
  "DATA_DESTRUCTION_CERTIFICATE",
  "SIGNED_AUTHORIZATION",
  "OTHER",
]);

export async function uploadAssetEvidence(
  assetId: string,
  formData: FormData
) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      organizationId: true,
      status: true,
    },
  });

  if (!asset) {
    throw new Error("Asset not found.");
  }

  const user = await requireOrganizationPermission(
    "evidence.upload",
    asset.organizationId
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

  if (!ASSET_EVIDENCE_TYPES.has(evidenceType)) {
    throw new Error(
      "That evidence type is not valid for asset-level evidence."
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
    asset.organizationId,
    "assets",
    asset.id,
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
      await tx.evidence.create({
        data: {
          organizationId: asset.organizationId,
          assetId: asset.id,
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

      await tx.assetEvent.create({
        data: {
          assetId: asset.id,
          eventType: "ASSET_EVIDENCE_ADDED",
          fromStatus: asset.status,
          toStatus: asset.status,
          actor: currentUserLabel(user),
          notes: [
            `Evidence type: ${evidenceTypeRaw}.`,
            description || null,
          ]
            .filter(Boolean)
            .join(" "),
        },
      });
    });
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }

  revalidatePath(`/assets/${asset.id}`);
}


const SERVICE_REQUEST_EVIDENCE_TYPES = new Set<EvidenceType>([
  "FIELD_DIAGNOSTIC",
  "WARRANTY_CLAIM",
  "TICKET_RECORD",
  "DAMAGE",
  "SERIAL_ASSET_TAG",
  "OTHER",
]);

export async function uploadServiceRequestEvidence(
  serviceRequestId: string,
  formData: FormData
) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    select: {
      id: true,
      organizationId: true,
      assetId: true,
    },
  });

  if (!request) {
    throw new Error("Service request not found.");
  }

  const user = await requireOrganizationPermission(
    "evidence.upload",
    request.organizationId
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

  if (!SERVICE_REQUEST_EVIDENCE_TYPES.has(evidenceType)) {
    throw new Error(
      "That evidence type is not valid for a service request."
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
    request.organizationId,
    "service-requests",
    request.id,
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
    await prisma.evidence.create({
      data: {
        organizationId: request.organizationId,
        assetId: request.assetId,
        serviceRequestId: request.id,
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
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }

  revalidatePath(`/service-requests/${request.id}`);
}

const AUTHORIZATION_EVIDENCE_TYPES = new Set<EvidenceType>([
  "SIGNED_AUTHORIZATION",
  "OTHER",
]);

export async function uploadAuthorizationEvidence(
  authorizationId: string,
  formData: FormData
) {
  const authorization = await prisma.authorization.findUnique({
    where: { id: authorizationId },
    select: {
      id: true,
      serviceRequestId: true,
      serviceRequest: {
        select: {
          organizationId: true,
          assetId: true,
        },
      },
    },
  });

  if (!authorization) {
    throw new Error("Authorization not found.");
  }

  const organizationId =
    authorization.serviceRequest.organizationId;
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

  if (!AUTHORIZATION_EVIDENCE_TYPES.has(evidenceType)) {
    throw new Error(
      "That evidence type is not valid for authorization evidence."
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
    "authorizations",
    authorization.id,
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
    await prisma.evidence.create({
      data: {
        organizationId,
        assetId: authorization.serviceRequest.assetId ?? null,
        authorizationId: authorization.id,
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
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }

  revalidatePath(
    `/service-requests/${authorization.serviceRequestId}`
  );
}

const SHIPMENT_EVIDENCE_TYPES = new Set<EvidenceType>([
  "SHIPPING_LABEL",
  "PACKAGE_EXTERIOR",
  "DAMAGE",
  "PACKING",
  "OUTBOUND_SHIPMENT",
  "OTHER",
]);

export async function uploadShipmentEvidence(
  shipmentId: string,
  formData: FormData
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      serviceRequestId: true,
      direction: true,
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
  });

  if (!shipment) {
    throw new Error("Shipment not found.");
  }

  const organizationId =
    shipment.serviceRequest.organizationId;
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

  if (!SHIPMENT_EVIDENCE_TYPES.has(evidenceType)) {
    throw new Error(
      "That evidence type is not valid for shipment evidence."
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
    "shipments",
    shipment.id,
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

  const workOrder = shipment.workOrders[0] ?? null;

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
              `${shipment.direction} shipment evidence: ${evidenceTypeRaw}.`,
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
          assetId: shipment.serviceRequest.assetId ?? null,
          workOrderId: workOrder?.id ?? null,
          workOrderEventId,
          shipmentId: shipment.id,
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
    `/service-requests/${shipment.serviceRequestId}`
  );

  if (workOrder) {
    revalidatePath(`/work-orders/${workOrder.id}`);
  }
}
