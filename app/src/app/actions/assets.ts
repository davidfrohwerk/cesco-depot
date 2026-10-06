"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

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
