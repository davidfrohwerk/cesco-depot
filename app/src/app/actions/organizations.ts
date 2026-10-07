"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createOrganization(formData: FormData) {
  await requirePermission("organization.manage");

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Organization name is required.");
  }

  await prisma.organization.create({
    data: { name },
  });

  revalidatePath("/organizations");
}
