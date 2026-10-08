"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationPermission } from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";
import { EndpointType } from "../../../generated/prisma/client";

export async function createEndpoint(
  organizationId: string,
  formData: FormData
) {
  await requireOrganizationPermission("endpoint.manage", organizationId);

  const name = String(formData.get("name") ?? "").trim();
  const externalCode = String(formData.get("externalCode") ?? "").trim();
  const type = String(formData.get("type") ?? "OTHER").trim() as EndpointType;
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const serviceNotes = String(formData.get("serviceNotes") ?? "").trim();

  if (!name) {
    throw new Error("Endpoint name is required.");
  }

  await prisma.endpoint.create({
    data: {
      organizationId,
      name,
      externalCode: externalCode || null,
      type,
      addressLine1: addressLine1 || null,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
      region: region || null,
      serviceNotes: serviceNotes || null,
    },
  });

  revalidatePath(`/organizations/${organizationId}`);
}
