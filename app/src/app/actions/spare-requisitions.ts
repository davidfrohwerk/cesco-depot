"use server";

import { revalidatePath } from "next/cache";
import {
  requireOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

export async function createSpareRequisition(
  organizationId: string,
  formData: FormData
) {
  const user = await requireOrganizationPermission(
    "spare_requisition.create",
    organizationId
  );

  const destinationEndpointId = String(
    formData.get("destinationEndpointId") ?? ""
  ).trim();
  const manufacturer = String(
    formData.get("manufacturer") ?? ""
  ).trim();
  const model = String(formData.get("model") ?? "").trim();
  const compatibilityNotes = String(
    formData.get("compatibilityNotes") ?? ""
  ).trim();
  const troubleTicketReference = String(
    formData.get("troubleTicketReference") ?? ""
  ).trim();
  const priority = String(
    formData.get("priority") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!destinationEndpointId) {
    throw new Error("Destination endpoint is required.");
  }

  if (!manufacturer && !model && !compatibilityNotes) {
    throw new Error(
      "Describe the required spare by manufacturer, model, or compatibility notes."
    );
  }

  const endpoint = await prisma.endpoint.findUnique({
    where: { id: destinationEndpointId },
    select: {
      organizationId: true,
      isActive: true,
    },
  });

  if (
    !endpoint ||
    !endpoint.isActive ||
    endpoint.organizationId !== organizationId
  ) {
    throw new Error(
      "Destination endpoint must be an active endpoint for this organization."
    );
  }

  await prisma.spareRequisition.create({
    data: {
      organizationId,
      requestedByUserId: user.id,
      destinationEndpointId,
      manufacturer: manufacturer || null,
      model: model || null,
      compatibilityNotes: compatibilityNotes || null,
      troubleTicketReference: troubleTicketReference || null,
      priority: priority || null,
      notes: notes || null,
    },
  });

  revalidatePath(`/organizations/${organizationId}/spares`);
}

export async function reserveSpareForRequisition(
  requisitionId: string,
  formData: FormData
) {
  const requisitionForAccess =
    await prisma.spareRequisition.findUnique({
      where: { id: requisitionId },
      select: { organizationId: true },
    });

  if (!requisitionForAccess) {
    throw new Error("Spare requisition not found.");
  }

  const user = await requireOrganizationPermission(
    "spare_requisition.manage",
    requisitionForAccess.organizationId
  );

  const assetId = String(
    formData.get("assetId") ?? ""
  ).trim();

  if (!assetId) {
    throw new Error("A candidate spare asset is required.");
  }

  await prisma.$transaction(async (tx) => {
    const requisition = await tx.spareRequisition.findUnique({
      where: { id: requisitionId },
    });

    if (!requisition) {
      throw new Error("Spare requisition not found.");
    }

    if (requisition.status !== "OPEN") {
      throw new Error(
        "Only an open spare requisition can be reserved."
      );
    }

    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      include: {
        currentStoragePosition: {
          include: {
            serviceLocation: {
              include: {
                clientAccess: {
                  where: {
                    organizationId:
                      requisition.organizationId,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !asset ||
      asset.organizationId !== requisition.organizationId ||
      !["READY", "STOCKED"].includes(asset.status) ||
      !asset.currentStoragePosition
    ) {
      throw new Error(
        "Candidate must be a ready or stocked asset belonging to this organization and stored at a managed position."
      );
    }

    const position = asset.currentStoragePosition;

    if (
      position.dedicatedOrganizationId &&
      position.dedicatedOrganizationId !==
        requisition.organizationId
    ) {
      throw new Error(
        "Candidate spare is stored in a position dedicated to another organization."
      );
    }

    if (
      !position.dedicatedOrganizationId &&
      position.serviceLocation.clientAccess.length === 0
    ) {
      throw new Error(
        "Candidate spare is not at a service location available to this organization."
      );
    }

    const alreadyReserved =
      await tx.spareRequisition.findFirst({
        where: {
          assignedAssetId: asset.id,
          status: "RESERVED",
          id: { not: requisition.id },
        },
        select: { id: true },
      });

    if (alreadyReserved) {
      throw new Error(
        "That spare is already reserved for another requisition."
      );
    }

    await tx.spareRequisition.update({
      where: { id: requisition.id },
      data: {
        assignedByUserId: user.id,
        assignedAssetId: asset.id,
        sourceStoragePositionId: position.id,
        status: "RESERVED",
        reservedAt: new Date(),
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "SPARE_RESERVED",
        fromStatus: asset.status,
        toStatus: asset.status,
        actor: user.displayName ?? user.email,
        notes: [
          `Reserved for spare requisition ${requisition.id}.`,
          requisition.troubleTicketReference
            ? `Trouble ticket ${requisition.troubleTicketReference}.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });
  });

  revalidatePath(
    `/organizations/${requisitionForAccess.organizationId}/spares`
  );
}

export async function cancelSpareRequisition(
  requisitionId: string
) {
  const requisitionForAccess =
    await prisma.spareRequisition.findUnique({
      where: { id: requisitionId },
      select: {
        organizationId: true,
        status: true,
      },
    });

  if (!requisitionForAccess) {
    throw new Error("Spare requisition not found.");
  }

  await requireOrganizationPermission(
    "spare_requisition.create",
    requisitionForAccess.organizationId
  );

  if (
    !["OPEN", "RESERVED"].includes(
      requisitionForAccess.status
    )
  ) {
    throw new Error(
      "Only open or reserved requisitions can be cancelled."
    );
  }

  await prisma.spareRequisition.update({
    where: { id: requisitionId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  revalidatePath(
    `/organizations/${requisitionForAccess.organizationId}/spares`
  );
}
