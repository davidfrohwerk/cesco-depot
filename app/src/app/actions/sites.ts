"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createSite(
  organizationId: string,
  formData: FormData
) {
  await requirePermission("organization.manage", organizationId);

  const name = String(formData.get("name") ?? "").trim();
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();

  if (!name) {
    throw new Error("Site name is required.");
  }

  await prisma.site.create({
    data: {
      organizationId,
      name,
      addressLine1: addressLine1 || null,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
    },
  });

  revalidatePath(`/organizations/${organizationId}`);
}
