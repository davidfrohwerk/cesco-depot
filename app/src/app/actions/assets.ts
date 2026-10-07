"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  currentUserLabel,
  requirePermission,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createAsset(
  organizationId: string,
  formData: FormData
) {
  const user = await requirePermission(
    "asset.manage",
    organizationId
  );
  const actorLabel = currentUserLabel(user);

  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!assetTag) {
    throw new Error("Asset tag is required.");
  }

  if (siteId) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { organizationId: true },
    });

    if (!site || site.organizationId !== organizationId) {
      throw new Error(
        "Asset site must belong to the selected organization."
      );
    }
  }

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        assetTag,
        organizationId,
        ownerOrganizationId: organizationId,
        siteId: siteId || null,
        currentCustodyType: "CUSTOMER",
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
        actor: actorLabel,
        notes:
          "Asset registered in CESCo Depot. Account organization recorded as initial owner; custody remains with customer until an explicit custody event occurs.",
      },
    });

    return created;
  });

  revalidatePath(`/organizations/${organizationId}`);
  redirect(`/assets/${asset.id}`);
}
