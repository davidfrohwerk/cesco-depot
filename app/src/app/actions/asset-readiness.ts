"use server";

import { revalidatePath } from "next/cache";
import { currentUserLabel } from "@/lib/auth";
import { requireOrganizationPermission } from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Readiness date is invalid.");
  }

  return date;
}

export async function updateAssetReadiness(
  assetId: string,
  formData: FormData
) {
  const assetForAccess = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { organizationId: true },
  });

  if (!assetForAccess) {
    throw new Error("Asset not found.");
  }

  const user = await requireOrganizationPermission(
    "asset.manage",
    assetForAccess.organizationId
  );

  const assetClass = String(
    formData.get("assetClass") ?? ""
  ).trim();
  const compatibilityClass = String(
    formData.get("compatibilityClass") ?? ""
  ).trim();
  const configurationVersion = String(
    formData.get("configurationVersion") ?? ""
  ).trim();
  const readinessNotes = String(
    formData.get("readinessNotes") ?? ""
  ).trim();
  const lastReadinessVerifiedAt = parseOptionalDate(
    formData.get("lastReadinessVerifiedAt")
  );
  const nextReadinessDueAt = parseOptionalDate(
    formData.get("nextReadinessDueAt")
  );
  const markReady = formData.get("markReady") === "on";

  if (
    lastReadinessVerifiedAt &&
    nextReadinessDueAt &&
    nextReadinessDueAt < lastReadinessVerifiedAt
  ) {
    throw new Error(
      "Next readiness due date cannot precede the verification date."
    );
  }

  await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new Error("Asset not found.");
    }

    await tx.asset.update({
      where: { id: assetId },
      data: {
        assetClass: assetClass || null,
        compatibilityClass: compatibilityClass || null,
        configurationVersion: configurationVersion || null,
        lastReadinessVerifiedAt,
        nextReadinessDueAt,
        readinessNotes: readinessNotes || null,
        status: markReady ? "READY" : asset.status,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId,
        eventType: "READINESS_UPDATED",
        fromStatus: asset.status,
        toStatus: markReady ? "READY" : asset.status,
        actor: currentUserLabel(user),
        notes: [
          compatibilityClass
            ? `Compatibility class: ${compatibilityClass}.`
            : null,
          configurationVersion
            ? `Configuration: ${configurationVersion}.`
            : null,
          lastReadinessVerifiedAt
            ? `Readiness verified ${lastReadinessVerifiedAt.toISOString()}.`
            : null,
          nextReadinessDueAt
            ? `Next verification due ${nextReadinessDueAt.toISOString()}.`
            : null,
          readinessNotes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });
  });

  revalidatePath(`/assets/${assetId}`);
  revalidatePath(
    `/organizations/${assetForAccess.organizationId}/spares`
  );
}
