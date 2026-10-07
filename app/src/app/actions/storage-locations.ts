"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StorageLocationType } from "../../../generated/prisma/client";

export async function createStorageLocation(
  siteId: string,
  formData: FormData
) {
  await requireCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const type = String(
    formData.get("type") ?? "OTHER"
  ).trim() as StorageLocationType;
  const parentId = String(formData.get("parentId") ?? "").trim();

  if (!name) {
    throw new Error("Storage location name is required.");
  }

  if (parentId) {
    const parent = await prisma.storageLocation.findUnique({
      where: { id: parentId },
    });

    if (!parent || parent.siteId !== siteId) {
      throw new Error(
        "Parent storage location must belong to the same site."
      );
    }
  }

  await prisma.storageLocation.create({
    data: {
      siteId,
      parentId: parentId || null,
      name,
      code: code || null,
      type,
    },
  });

  revalidatePath(`/sites/${siteId}`);
}
