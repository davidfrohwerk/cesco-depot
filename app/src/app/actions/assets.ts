"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUserLabel } from "@/lib/auth";
import { requireOrganizationPermission } from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

export async function createAsset(
  organizationId: string,
  formData: FormData
) {
  const user = await requireOrganizationPermission(
    "asset.manage",
    organizationId
  );
  const actorLabel = currentUserLabel(user);

  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const endpointId = String(formData.get("endpointId") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const assetClass = String(formData.get("assetClass") ?? "").trim();
  const compatibilityClass = String(
    formData.get("compatibilityClass") ?? ""
  ).trim();
  const configurationVersion = String(
    formData.get("configurationVersion") ?? ""
  ).trim();
  const description = String(formData.get("description") ?? "").trim();
  const warrantyProvider = String(
    formData.get("warrantyProvider") ?? ""
  ).trim();
  const warrantyReference = String(
    formData.get("warrantyReference") ?? ""
  ).trim();
  const warrantyExpiresAtRaw = String(
    formData.get("warrantyExpiresAt") ?? ""
  ).trim();
  const warrantyExpiresAt = warrantyExpiresAtRaw
    ? new Date(warrantyExpiresAtRaw)
    : null;
  const warrantyNotes = String(
    formData.get("warrantyNotes") ?? ""
  ).trim();

  if (
    warrantyExpiresAt &&
    Number.isNaN(warrantyExpiresAt.getTime())
  ) {
    throw new Error("Warranty expiration date is invalid.");
  }

  if (!assetTag) {
    throw new Error("Asset tag is required.");
  }

  const existingAsset = await prisma.asset.findUnique({
    where: {
      organizationId_assetTag: {
        organizationId,
        assetTag,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingAsset) {
    redirect(
      `/organizations/${organizationId}?assetError=duplicate&assetTag=${encodeURIComponent(
        assetTag
      )}`
    );
  }

  if (endpointId) {
    const endpoint = await prisma.endpoint.findUnique({
      where: { id: endpointId },
      select: { organizationId: true, isActive: true },
    });

    if (
      !endpoint ||
      !endpoint.isActive ||
      endpoint.organizationId !== organizationId
    ) {
      throw new Error(
        "Asset endpoint must be an active endpoint for the selected organization."
      );
    }
  }

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        assetTag,
        organizationId,
        ownerOrganizationId: organizationId,
        currentEndpointId: endpointId || null,
        currentStoragePositionId: null,
        currentCustodyType: "CUSTOMER",
        manufacturer: manufacturer || null,
        model: model || null,
        serialNumber: serialNumber || null,
        assetClass: assetClass || null,
        compatibilityClass: compatibilityClass || null,
        configurationVersion: configurationVersion || null,
        description: description || null,
        warrantyProvider: warrantyProvider || null,
        warrantyReference: warrantyReference || null,
        warrantyExpiresAt,
        warrantyNotes: warrantyNotes || null,
        status: "REGISTERED",
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: created.id,
        eventType: "ASSET_REGISTERED",
        fromStatus: null,
        toStatus: "REGISTERED",
        actor: actorLabel,
        notes: endpointId
          ? "Asset registered in CESCo Depot at a client/downstream endpoint. Account organization recorded as initial owner; custody remains with customer until an explicit custody event occurs."
          : "Asset registered in CESCo Depot. Account organization recorded as initial owner; custody remains with customer until an explicit custody event occurs.",
      },
    });

    return created;
  });

  revalidatePath(`/organizations/${organizationId}`);
  redirect(`/assets/${asset.id}`);
}
