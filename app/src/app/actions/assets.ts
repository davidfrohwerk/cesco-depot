"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AssetStatus } from "../../../generated/prisma/client";

const allowedTransitions: Partial<Record<AssetStatus, readonly AssetStatus[]>> = {
  REGISTERED: ["RECEIVED"],
  RECEIVED: ["INSPECTION"],
  INSPECTION: ["REPAIR"],
  REPAIR: ["TESTING"],
  TESTING: ["READY"],
  READY: [],
};

export async function createAsset(
  organizationId: string,
  formData: FormData
) {
  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!assetTag) {
    throw new Error("Asset tag is required.");
  }

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        assetTag,
        organizationId,
        siteId: siteId || null,
        manufacturer: manufacturer || null,
        model: model || null,
        serialNumber: serialNumber || null,
        description: description || null,
        status: "REGISTERED",
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: created.id,
        eventType: "ASSET_REGISTERED",
        fromStatus: null,
        toStatus: "REGISTERED",
        actor: "system",
        notes: "Asset registered in CESCo Depot.",
      },
    });

    return created;
  });

  revalidatePath(`/organizations/${organizationId}`);
  redirect(`/assets/${asset.id}`);
}

export async function transitionAsset(
  assetId: string,
  formData: FormData
) {
  const requestedStatus = String(
    formData.get("status") ?? ""
  ).trim() as AssetStatus;

  const note = String(
    formData.get("note") ?? ""
  ).trim();

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    throw new Error("Asset not found.");
  }

  const allowed = allowedTransitions[asset.status] ?? [];

  if (!allowed.includes(requestedStatus)) {
    throw new Error(
      `Invalid asset transition: ${asset.status} -> ${requestedStatus}`
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.asset.update({
      where: { id: assetId },
      data: {
        status: requestedStatus,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId,
        eventType: `STATUS_CHANGED_TO_${requestedStatus}`,
        fromStatus: asset.status,
        toStatus: requestedStatus,
        actor: "depot-dev",
        notes: note || null,
      },
    });
  });

  revalidatePath(`/assets/${assetId}`);
}
