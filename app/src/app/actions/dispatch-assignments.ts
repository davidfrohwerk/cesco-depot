"use server";

import { revalidatePath } from "next/cache";
import {
  requireOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";
import { CustodyType } from "../../../generated/prisma/client";

const allowedProviderCustody = new Set<CustodyType>([
  "CARRIER",
  "FIELD_TECHNICIAN",
  "PARTNER",
  "OTHER",
]);

function parseProviderCustody(value: FormDataEntryValue | null) {
  const custodyType = String(value ?? "").trim() as CustodyType;

  if (!allowedProviderCustody.has(custodyType)) {
    throw new Error("A valid dispatch custody type is required.");
  }

  return custodyType;
}

export async function createDispatchForReservedSpare(
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
    "dispatch.manage",
    requisitionForAccess.organizationId
  );

  const providerCustodyType = parseProviderCustody(
    formData.get("providerCustodyType")
  );
  const providerLabel = String(
    formData.get("providerLabel") ?? ""
  ).trim();
  const externalReference = String(
    formData.get("externalReference") ?? ""
  ).trim();
  const instructions = String(
    formData.get("instructions") ?? ""
  ).trim();

  if (!providerLabel) {
    throw new Error("Carrier, courier, technician, or provider label is required.");
  }

  await prisma.$transaction(async (tx) => {
    const requisition = await tx.spareRequisition.findUnique({
      where: { id: requisitionId },
      include: {
        assignedAsset: true,
        sourceStoragePosition: true,
        destinationEndpoint: true,
        dispatchAssignments: {
          where: {
            status: {
              in: ["ASSIGNED", "IN_TRANSIT"],
            },
          },
          select: { id: true },
        },
      },
    });

    if (
      !requisition ||
      requisition.status !== "RESERVED" ||
      !requisition.assignedAsset ||
      !requisition.sourceStoragePositionId
    ) {
      throw new Error(
        "A reserved spare with a recorded source position is required before dispatch."
      );
    }

    if (requisition.dispatchAssignments.length > 0) {
      throw new Error(
        "An active dispatch assignment already exists for this requisition."
      );
    }

    const asset = requisition.assignedAsset;

    if (
      asset.currentStoragePositionId !==
      requisition.sourceStoragePositionId
    ) {
      throw new Error(
        "Reserved asset is no longer at the recorded source position."
      );
    }

    await tx.dispatchAssignment.create({
      data: {
        organizationId: requisition.organizationId,
        spareRequisitionId: requisition.id,
        assetId: asset.id,
        assignedByUserId: user.id,
        originStoragePositionId:
          requisition.sourceStoragePositionId,
        destinationEndpointId:
          requisition.destinationEndpointId,
        providerCustodyType,
        providerLabel,
        externalReference: externalReference || null,
        instructions: instructions || null,
        status: "ASSIGNED",
      },
    });
  });

  revalidatePath(
    `/organizations/${requisitionForAccess.organizationId}/spares`
  );
}

export async function createReverseDispatch(
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
    "dispatch.manage",
    assetForAccess.organizationId
  );

  const destinationStoragePositionId = String(
    formData.get("destinationStoragePositionId") ?? ""
  ).trim();
  const providerCustodyType = parseProviderCustody(
    formData.get("providerCustodyType")
  );
  const providerLabel = String(
    formData.get("providerLabel") ?? ""
  ).trim();
  const externalReference = String(
    formData.get("externalReference") ?? ""
  ).trim();
  const instructions = String(
    formData.get("instructions") ?? ""
  ).trim();

  if (!destinationStoragePositionId || !providerLabel) {
    throw new Error(
      "Destination storage position and provider are required."
    );
  }

  await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      include: {
        currentEndpoint: true,
      },
    });

    if (!asset || !asset.currentEndpointId) {
      throw new Error(
        "Reverse dispatch requires an asset currently placed at a client endpoint."
      );
    }

    const destination = await tx.storagePosition.findUnique({
      where: { id: destinationStoragePositionId },
      include: {
        serviceLocation: {
          include: {
            clientAccess: {
              where: {
                organizationId: asset.organizationId,
              },
              select: { organizationId: true },
            },
          },
        },
      },
    });

    if (
      !destination ||
      !destination.isActive ||
      !destination.serviceLocation.isActive
    ) {
      throw new Error("Destination storage position is unavailable.");
    }

    if (
      destination.dedicatedOrganizationId &&
      destination.dedicatedOrganizationId !==
        asset.organizationId
    ) {
      throw new Error(
        "Destination storage position is dedicated to another client."
      );
    }

    if (
      !destination.dedicatedOrganizationId &&
      destination.serviceLocation.clientAccess.length === 0
    ) {
      throw new Error(
        "Destination service location is not available to this organization."
      );
    }

    const activeDispatch = await tx.dispatchAssignment.findFirst({
      where: {
        assetId: asset.id,
        status: {
          in: ["ASSIGNED", "IN_TRANSIT"],
        },
      },
      select: { id: true },
    });

    if (activeDispatch) {
      throw new Error(
        "This asset already has an active dispatch assignment."
      );
    }

    await tx.dispatchAssignment.create({
      data: {
        organizationId: asset.organizationId,
        assetId: asset.id,
        assignedByUserId: user.id,
        originEndpointId: asset.currentEndpointId,
        destinationStoragePositionId:
          destinationStoragePositionId,
        providerCustodyType,
        providerLabel,
        externalReference: externalReference || null,
        instructions: instructions || null,
        status: "ASSIGNED",
      },
    });
  });

  revalidatePath(`/assets/${assetId}`);
}

export async function acceptDispatchCustody(
  dispatchAssignmentId: string
) {
  const dispatchForAccess =
    await prisma.dispatchAssignment.findUnique({
      where: { id: dispatchAssignmentId },
      select: { organizationId: true },
    });

  if (!dispatchForAccess) {
    throw new Error("Dispatch assignment not found.");
  }

  const user = await requireOrganizationPermission(
    "dispatch.manage",
    dispatchForAccess.organizationId
  );

  const result = await prisma.$transaction(async (tx) => {
    const dispatch = await tx.dispatchAssignment.findUnique({
      where: { id: dispatchAssignmentId },
      include: {
        asset: true,
        destinationEndpoint: true,
        destinationStoragePosition: {
          include: {
            serviceLocation: true,
          },
        },
      },
    });

    if (!dispatch) {
      throw new Error("Dispatch assignment not found.");
    }

    if (dispatch.status !== "ASSIGNED") {
      throw new Error(
        "Only an assigned dispatch can accept custody."
      );
    }

    const asset = dispatch.asset;

    if (
      dispatch.originEndpointId &&
      asset.currentEndpointId !== dispatch.originEndpointId
    ) {
      throw new Error(
        "Asset is no longer at the recorded origin endpoint."
      );
    }

    if (
      dispatch.originStoragePositionId &&
      asset.currentStoragePositionId !==
        dispatch.originStoragePositionId
    ) {
      throw new Error(
        "Asset is no longer at the recorded origin storage position."
      );
    }

    const now = new Date();

    await tx.dispatchAssignment.update({
      where: { id: dispatch.id },
      data: {
        status: "IN_TRANSIT",
        acceptedAt: now,
      },
    });

    if (dispatch.spareRequisitionId) {
      await tx.spareRequisition.update({
        where: { id: dispatch.spareRequisitionId },
        data: {
          status: "DISPATCHED",
          dispatchedAt: now,
        },
      });
    }

    await tx.assetMovement.create({
      data: {
        assetId: asset.id,
        actorUserId: user.id,
        fromEndpointId: asset.currentEndpointId,
        fromStoragePositionId:
          asset.currentStoragePositionId,
        toEndpointId: null,
        toStoragePositionId: null,
        fromCustodyType: asset.currentCustodyType,
        toCustodyType: dispatch.providerCustodyType,
        fromCustodianLabel: asset.currentCustodianLabel,
        toCustodianLabel: dispatch.providerLabel,
        reason: [
          "Dispatch custody accepted.",
          dispatch.externalReference
            ? `Reference ${dispatch.externalReference}.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
        occurredAt: now,
      },
    });

    await tx.asset.update({
      where: { id: asset.id },
      data: {
        status: "DISPATCHED",
        currentEndpointId: null,
        currentStoragePositionId: null,
        currentStorageLocationId: null,
        siteId: null,
        currentCustodyType:
          dispatch.providerCustodyType,
        currentCustodianLabel: dispatch.providerLabel,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "DISPATCH_CUSTODY_ACCEPTED",
        fromStatus: asset.status,
        toStatus: "DISPATCHED",
        actor: user.displayName ?? user.email,
        notes: [
          `${dispatch.providerLabel} accepted custody.`,
          dispatch.externalReference
            ? `Reference ${dispatch.externalReference}.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return {
      organizationId: dispatch.organizationId,
      assetId: asset.id,
      spareRequisitionId: dispatch.spareRequisitionId,
    };
  });

  revalidatePath(`/assets/${result.assetId}`);
  if (result.spareRequisitionId) {
    revalidatePath(
      `/organizations/${result.organizationId}/spares`
    );
  }
}

export async function completeDispatch(
  dispatchAssignmentId: string,
  formData: FormData
) {
  const dispatchForAccess =
    await prisma.dispatchAssignment.findUnique({
      where: { id: dispatchAssignmentId },
      select: { organizationId: true },
    });

  if (!dispatchForAccess) {
    throw new Error("Dispatch assignment not found.");
  }

  const user = await requireOrganizationPermission(
    "dispatch.manage",
    dispatchForAccess.organizationId
  );
  const completionNotes = String(
    formData.get("completionNotes") ?? ""
  ).trim();

  const result = await prisma.$transaction(async (tx) => {
    const dispatch = await tx.dispatchAssignment.findUnique({
      where: { id: dispatchAssignmentId },
      include: {
        asset: true,
        destinationEndpoint: true,
        destinationStoragePosition: {
          include: {
            serviceLocation: true,
          },
        },
      },
    });

    if (!dispatch) {
      throw new Error("Dispatch assignment not found.");
    }

    if (dispatch.status !== "IN_TRANSIT") {
      throw new Error(
        "Dispatch must be in transit before completion."
      );
    }

    const hasEndpointDestination =
      Boolean(dispatch.destinationEndpointId);
    const hasStorageDestination =
      Boolean(dispatch.destinationStoragePositionId);

    if (
      hasEndpointDestination === hasStorageDestination
    ) {
      throw new Error(
        "Dispatch must have exactly one physical destination."
      );
    }

    const now = new Date();
    const destinationLabel =
      dispatch.destinationEndpoint?.name ??
      (dispatch.destinationStoragePosition
        ? `${dispatch.destinationStoragePosition.serviceLocation.name} / ${dispatch.destinationStoragePosition.name}`
        : "destination");

    const destinationCustodyType =
      dispatch.destinationEndpoint
        ? "CUSTOMER"
        : dispatch.destinationStoragePosition?.serviceLocation
            .custodyType ?? "CESCO";

    const destinationCustodianLabel =
      dispatch.destinationEndpoint?.name ??
      dispatch.destinationStoragePosition?.serviceLocation
        .custodianLabel ??
      dispatch.destinationStoragePosition?.serviceLocation
        .operatorLabel ??
      dispatch.destinationStoragePosition?.serviceLocation
        .name ??
      "CESCo";

    await tx.dispatchAssignment.update({
      where: { id: dispatch.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
      },
    });

    if (dispatch.spareRequisitionId) {
      await tx.spareRequisition.update({
        where: { id: dispatch.spareRequisitionId },
        data: {
          status: "FULFILLED",
          fulfilledAt: now,
        },
      });
    }

    await tx.assetMovement.create({
      data: {
        assetId: dispatch.asset.id,
        actorUserId: user.id,
        fromEndpointId: null,
        fromStoragePositionId: null,
        toEndpointId: dispatch.destinationEndpointId,
        toStoragePositionId:
          dispatch.destinationStoragePositionId,
        fromCustodyType:
          dispatch.asset.currentCustodyType,
        toCustodyType: destinationCustodyType,
        fromCustodianLabel:
          dispatch.asset.currentCustodianLabel,
        toCustodianLabel: destinationCustodianLabel,
        reason: [
          `Dispatch completed at ${destinationLabel}.`,
          completionNotes || null,
        ]
          .filter(Boolean)
          .join(" "),
        occurredAt: now,
      },
    });

    await tx.asset.update({
      where: { id: dispatch.asset.id },
      data: {
        status: dispatch.destinationEndpoint
          ? "DELIVERED"
          : "STOCKED",
        currentEndpointId:
          dispatch.destinationEndpointId,
        currentStoragePositionId:
          dispatch.destinationStoragePositionId,
        currentStorageLocationId: null,
        siteId: null,
        currentCustodyType: destinationCustodyType,
        currentCustodianLabel:
          destinationCustodianLabel,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: dispatch.asset.id,
        eventType: dispatch.destinationEndpoint
          ? "DISPATCH_DELIVERED_TO_ENDPOINT"
          : "DISPATCH_RETURNED_TO_STORAGE",
        fromStatus: dispatch.asset.status,
        toStatus: dispatch.destinationEndpoint
          ? "DELIVERED"
          : "STOCKED",
        actor: user.displayName ?? user.email,
        notes: [
          `Dispatch completed at ${destinationLabel}.`,
          completionNotes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return {
      organizationId: dispatch.organizationId,
      assetId: dispatch.asset.id,
      spareRequisitionId: dispatch.spareRequisitionId,
    };
  });

  revalidatePath(`/assets/${result.assetId}`);
  if (result.spareRequisitionId) {
    revalidatePath(
      `/organizations/${result.organizationId}/spares`
    );
  }
}
