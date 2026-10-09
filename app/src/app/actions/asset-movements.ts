"use server";

import { revalidatePath } from "next/cache";
import { currentUserLabel } from "@/lib/auth";
import {
  requireInternalPermission,
  requireOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

export async function moveAssetToEndpoint(
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
    "asset.move",
    assetForAccess.organizationId
  );

  const endpointId = String(formData.get("endpointId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!endpointId) {
    throw new Error("Endpoint is required.");
  }

  const endpoint = await prisma.endpoint.findUnique({
    where: { id: endpointId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      isActive: true,
    },
  });

  if (
    !endpoint ||
    !endpoint.isActive ||
    endpoint.organizationId !== assetForAccess.organizationId
  ) {
    throw new Error("Endpoint must be an active endpoint for this organization.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new Error("Asset not found.");
    }

    await tx.assetMovement.create({
      data: {
        assetId: asset.id,
        actorUserId: user.id,
        fromEndpointId: asset.currentEndpointId,
        toEndpointId: endpoint.id,
        fromStoragePositionId: asset.currentStoragePositionId,
        toStoragePositionId: null,
        fromCustodyType: asset.currentCustodyType,
        toCustodyType: "CUSTOMER",
        fromCustodianLabel: asset.currentCustodianLabel,
        toCustodianLabel: endpoint.name,
        reason: reason || "Moved to client/downstream endpoint.",
      },
    });

    await tx.asset.update({
      where: { id: asset.id },
      data: {
        currentEndpointId: endpoint.id,
        currentStoragePositionId: null,
        currentStorageLocationId: null,
        siteId: null,
        currentCustodyType: "CUSTOMER",
        currentCustodianLabel: endpoint.name,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "ASSET_MOVED_TO_ENDPOINT",
        fromStatus: asset.status,
        toStatus: asset.status,
        actor: currentUserLabel(user),
        notes: [
          `Asset placement changed to ${endpoint.name}.`,
          reason || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return { organizationId: asset.organizationId };
  });

  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/organizations/${result.organizationId}`);
  revalidatePath(`/endpoints/${endpointId}`);
}

export async function placeAssetInStoragePosition(
  storagePositionId: string,
  formData: FormData
) {
  const user = await requireInternalPermission("service_location.manage");

  const organizationId = String(
    formData.get("organizationId") ?? ""
  ).trim();
  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!organizationId || !assetTag) {
    throw new Error("Client organization and asset tag are required.");
  }

  const [position, asset] = await Promise.all([
    prisma.storagePosition.findUnique({
      where: { id: storagePositionId },
      include: {
        serviceLocation: {
          include: {
            clientAccess: true,
          },
        },
        dedicatedOrganization: true,
      },
    }),
    prisma.asset.findUnique({
      where: {
        organizationId_assetTag: {
          organizationId,
          assetTag,
        },
      },
    }),
  ]);

  if (!position) {
    throw new Error("Storage position not found.");
  }

  if (!asset) {
    throw new Error("Asset tag was not found.");
  }

  const dedicatedToOtherClient =
    position.dedicatedOrganizationId &&
    position.dedicatedOrganizationId !== asset.organizationId;

  if (dedicatedToOtherClient) {
    throw new Error("That position is dedicated to another client.");
  }

  const clientHasLocationAccess =
    position.serviceLocation.clientAccess.some(
      (access) => access.organizationId === asset.organizationId
    );

  if (
    !position.dedicatedOrganizationId &&
    !clientHasLocationAccess
  ) {
    throw new Error(
      "This service location is not available to the asset's organization."
    );
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.asset.findUnique({
      where: { id: asset.id },
    });

    if (!current) {
      throw new Error("Asset not found.");
    }

    const custodianLabel =
      position.serviceLocation.custodianLabel ??
      position.serviceLocation.operatorLabel ??
      position.serviceLocation.name;

    await tx.assetMovement.create({
      data: {
        assetId: current.id,
        actorUserId: user.id,
        fromEndpointId: current.currentEndpointId,
        toEndpointId: null,
        fromStoragePositionId: current.currentStoragePositionId,
        toStoragePositionId: position.id,
        fromCustodyType: current.currentCustodyType,
        toCustodyType: position.serviceLocation.custodyType,
        fromCustodianLabel: current.currentCustodianLabel,
        toCustodianLabel: custodianLabel,
        reason: reason || "Placed into managed storage.",
      },
    });

    await tx.asset.update({
      where: { id: current.id },
      data: {
        currentEndpointId: null,
        currentStoragePositionId: position.id,
        currentStorageLocationId: null,
        siteId: null,
        currentCustodyType: position.serviceLocation.custodyType,
        currentCustodianLabel: custodianLabel,
        status:
          current.status === "REGISTERED"
            ? "STOCKED"
            : current.status,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: current.id,
        eventType: "ASSET_PLACED_IN_STORAGE",
        fromStatus: current.status,
        toStatus:
          current.status === "REGISTERED"
            ? "STOCKED"
            : current.status,
        actor: currentUserLabel(user),
        notes: [
          `Placed at ${position.serviceLocation.name} / ${position.name}.`,
          reason || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });
  });

  revalidatePath(`/assets/${asset.id}`);
  revalidatePath(
    `/service-locations/${position.serviceLocationId}`
  );
}
