"use server";

import { revalidatePath } from "next/cache";
import {
  requireInternalPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";
import {
  ServiceLocationType,
  StorageLocationType,
} from "../../../generated/prisma/client";

export async function createServiceLocation(formData: FormData) {
  const user = await requireInternalPermission("service_location.manage");

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const type = String(formData.get("type") ?? "OTHER").trim() as ServiceLocationType;
  const operatorLabel = String(formData.get("operatorLabel") ?? "").trim();
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const capabilities = String(formData.get("capabilities") ?? "").trim();
  const accessInstructions = String(formData.get("accessInstructions") ?? "").trim();
  const climateControlled = formData.get("climateControlled") === "on";
  const secureStorage = formData.get("secureStorage") === "on";

  if (!name) {
    throw new Error("Service location name is required.");
  }

  const internalMembership = user.memberships.find(
    (membership) => membership.organization.kind === "INTERNAL"
  );

  const location = await prisma.serviceLocation.create({
    data: {
      managedByOrganizationId: internalMembership?.organizationId ?? null,
      name,
      code: code || null,
      type,
      operatorLabel: operatorLabel || null,
      addressLine1: addressLine1 || null,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
      region: region || null,
      capabilities: capabilities || null,
      accessInstructions: accessInstructions || null,
      climateControlled,
      secureStorage,
    },
  });

  revalidatePath("/service-locations");
  return location.id;
}

export async function createStoragePosition(
  serviceLocationId: string,
  formData: FormData
) {
  await requireInternalPermission("service_location.manage");

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const type = String(formData.get("type") ?? "OTHER").trim() as StorageLocationType;
  const parentId = String(formData.get("parentId") ?? "").trim();
  const dedicatedOrganizationId = String(
    formData.get("dedicatedOrganizationId") ?? ""
  ).trim();
  const environmentalNotes = String(
    formData.get("environmentalNotes") ?? ""
  ).trim();
  const secureStorage = formData.get("secureStorage") === "on";

  if (!name) {
    throw new Error("Storage position name is required.");
  }

  if (parentId) {
    const parent = await prisma.storagePosition.findUnique({
      where: { id: parentId },
      select: { serviceLocationId: true },
    });

    if (!parent || parent.serviceLocationId !== serviceLocationId) {
      throw new Error("Parent position must belong to this service location.");
    }
  }

  if (dedicatedOrganizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: dedicatedOrganizationId },
      select: { kind: true },
    });

    if (!organization || organization.kind !== "CLIENT") {
      throw new Error("Dedicated storage may only reference a client organization.");
    }
  }

  await prisma.storagePosition.create({
    data: {
      serviceLocationId,
      parentId: parentId || null,
      dedicatedOrganizationId: dedicatedOrganizationId || null,
      name,
      code: code || null,
      type,
      secureStorage,
      environmentalNotes: environmentalNotes || null,
    },
  });

  revalidatePath(`/service-locations/${serviceLocationId}`);
}

export async function grantServiceLocationClientAccess(
  serviceLocationId: string,
  formData: FormData
) {
  await requireInternalPermission("service_location.manage");

  const organizationId = String(
    formData.get("organizationId") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!organizationId) {
    throw new Error("Client organization is required.");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { kind: true },
  });

  if (!organization || organization.kind !== "CLIENT") {
    throw new Error("Service-location access may only be granted to client organizations.");
  }

  await prisma.serviceLocationClient.upsert({
    where: {
      serviceLocationId_organizationId: {
        serviceLocationId,
        organizationId,
      },
    },
    update: { notes: notes || null },
    create: {
      serviceLocationId,
      organizationId,
      notes: notes || null,
    },
  });

  revalidatePath(`/service-locations/${serviceLocationId}`);
}
