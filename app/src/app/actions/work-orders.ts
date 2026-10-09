"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentUserLabel } from "@/lib/auth";
import { requireOrganizationPermission } from "@/lib/access-scope";
import {
  AssetCondition,
  WorkActivityType,
} from "../../../generated/prisma/client";
import {
  assertCanAcceptOutbound,
  assertCanAcknowledgeReceipt,
  assertCanBeginIntake,
  assertCanCompleteRepair,
  assertCanConfirmDelivery,
  assertCanCreateOutbound,
  assertCanPack,
  assertCanRecordQa,
  assertCanResumeRepair,
  assertCanResumeFromExternalService,
  assertCanWaitForExternalService,
  assertCanWaitForParts,
  qaTransition,
} from "@/lib/workflow-rules";

function parseOptionalCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Unit cost must be a non-negative number.");
  }

  return Math.round(amount * 100);
}

async function revalidateWorkOrder(workOrderId: string) {
  revalidatePath(`/work-orders/${workOrderId}`);
}

async function actorForOrganization(
  organizationId: string,
  permissionKey: string
) {
  const user = await requireOrganizationPermission(
    permissionKey,
    organizationId
  );

  return {
    user,
    label: currentUserLabel(user),
  };
}

async function actorForWorkOrder(
  workOrderId: string,
  permissionKey = "work_order.manage"
) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      organizationId: true,
      serviceRequest: {
        select: { organizationId: true },
      },
    },
  });

  const organizationId =
    workOrder?.organizationId ??
    workOrder?.serviceRequest?.organizationId;

  if (!workOrder || !organizationId) {
    throw new Error("Work order organization could not be resolved.");
  }

  return actorForOrganization(organizationId, permissionKey);
}

async function actorForPart(partId: string) {
  const part = await prisma.workOrderPart.findUnique({
    where: { id: partId },
    select: { workOrderId: true },
  });

  if (!part) {
    throw new Error("Part not found.");
  }

  return actorForWorkOrder(part.workOrderId);
}

async function actorForActivity(activityId: string) {
  const activity = await prisma.workActivity.findUnique({
    where: { id: activityId },
    select: { workOrderId: true },
  });

  if (!activity) {
    throw new Error("Activity not found.");
  }

  return actorForWorkOrder(activity.workOrderId);
}

async function actorForShipment(
  shipmentId: string,
  permissionKey = "shipment.manage"
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      serviceRequest: {
        select: { organizationId: true },
      },
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found.");
  }

  return actorForOrganization(
    shipment.serviceRequest.organizationId,
    permissionKey
  );
}

export async function beginWorkOrderIntake(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const actorLabel = actor.label;
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: { asset: true },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    assertCanBeginIntake(workOrder.status);

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { status: "INTAKE" },
    });

    await tx.asset.update({
      where: { id: workOrder.assetId },
      data: { status: "INSPECTION" },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType: "INTAKE_STARTED",
        fromStatus: "RECEIVED",
        toStatus: "INTAKE",
        actorUserId: actor.user.id,
        actorLabel,
        notes: notes || null,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: workOrder.assetId,
        eventType: "INSPECTION_STARTED",
        fromStatus: workOrder.asset.status,
        toStatus: "INSPECTION",
        actor: actorLabel,
        notes: notes || "Depot intake and inspection started.",
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}

export async function recordAssetObservation(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const observerLabel = actor.label;
  const observationType = String(
    formData.get("observationType") ?? ""
  ).trim();
  const condition = String(
    formData.get("condition") ?? "UNKNOWN"
  ).trim() as AssetCondition;
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    await tx.assetObservation.create({
      data: {
        assetId: workOrder.assetId,
        workOrderId,
        observerUserId: actor.user.id,
        observerLabel,
        observationType: observationType || null,
        condition,
        notes: notes || null,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType: "CONDITION_OBSERVED",
        fromStatus: workOrder.status,
        toStatus: workOrder.status,
        actorUserId: actor.user.id,
        actorLabel: observerLabel,
        notes: [
          `Condition: ${condition}.`,
          observationType
            ? `Observation: ${observationType}.`
            : null,
          notes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}

export async function startWorkActivity(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const workerLabel = actor.label;
  const activityType = String(
    formData.get("activityType") ?? ""
  ).trim() as WorkActivityType;
  const notes = String(formData.get("notes") ?? "").trim();
  const billable = formData.get("billable") === "on";
  const training = formData.get("training") === "on";
  const supervised = formData.get("supervised") === "on";

  if (!activityType) {
    throw new Error("Activity type is required.");
  }

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    const activeActivity = await tx.workActivity.findFirst({
      where: {
        workOrderId,
        endedAt: null,
      },
    });

    if (activeActivity) {
      throw new Error(
        "This work order already has an active labor/activity timer."
      );
    }

    const activity = await tx.workActivity.create({
      data: {
        workOrderId,
        workerUserId: actor.user.id,
        workerLabel,
        activityType,
        startedAt: new Date(),
        notes: notes || null,
        billable,
        training,
        supervised,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType: "ACTIVITY_STARTED",
        fromStatus: workOrder.status,
        toStatus: workOrder.status,
        actorUserId: actor.user.id,
        actorLabel: workerLabel,
        notes: `${activity.activityType} activity started.`,
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}

export async function stopWorkActivity(activityId: string) {
  const actor = await actorForActivity(activityId);

  const result = await prisma.$transaction(async (tx) => {
    const activity = await tx.workActivity.findUnique({
      where: { id: activityId },
      include: { workOrder: true },
    });

    if (!activity) {
      throw new Error("Activity not found.");
    }

    if (activity.endedAt) {
      return { workOrderId: activity.workOrderId };
    }

    const endedAt = new Date();
    const durationMinutes = Math.max(
      1,
      Math.ceil(
        (endedAt.getTime() - activity.startedAt.getTime()) /
          60000
      )
    );

    await tx.workActivity.update({
      where: { id: activityId },
      data: {
        endedAt,
        durationMinutes,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: activity.workOrderId,
        eventType: "ACTIVITY_COMPLETED",
        fromStatus: activity.workOrder.status,
        toStatus: activity.workOrder.status,
        actorUserId: actor.user.id,
        actorLabel: actor.label,
        notes: `${activity.activityType} completed; ${durationMinutes} minute(s) recorded.`,
      },
    });

    return { workOrderId: activity.workOrderId };
  });

  await revalidateWorkOrder(result.workOrderId);
}

export async function addRequiredPart(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const description = String(
    formData.get("description") ?? ""
  ).trim();
  const partNumber = String(
    formData.get("partNumber") ?? ""
  ).trim();
  const manufacturer = String(
    formData.get("manufacturer") ?? ""
  ).trim();
  const source = String(formData.get("source") ?? "").trim();
  const quantityRaw = Number(formData.get("quantity") ?? 1);
  const quantity =
    Number.isInteger(quantityRaw) && quantityRaw > 0
      ? quantityRaw
      : 1;
  const unitCostCents = parseOptionalCents(
    formData.get("unitCost")
  );

  if (!description) {
    throw new Error("Part description is required.");
  }

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    const part = await tx.workOrderPart.create({
      data: {
        workOrderId,
        description,
        partNumber: partNumber || null,
        manufacturer: manufacturer || null,
        source: source || null,
        quantity,
        unitCostCents,
        status: "REQUIRED",
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType: "PART_REQUIRED",
        fromStatus: workOrder.status,
        toStatus: workOrder.status,
        actorUserId: actor.user.id,
        actorLabel: actor.label,
        notes: [
          `${part.quantity} x ${part.description}`,
          part.partNumber
            ? `Part number: ${part.partNumber}.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}

export async function setWorkOrderWaitingParts(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const actorLabel = actor.label;
  const notes = String(formData.get("notes") ?? "").trim();


  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: { asset: true },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    assertCanWaitForParts(workOrder.status);

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { status: "WAITING_PARTS" },
    });

    await tx.asset.update({
      where: { id: workOrder.assetId },
      data: { status: "REPAIR" },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType: "WAITING_PARTS",
        fromStatus: workOrder.status,
        toStatus: "WAITING_PARTS",
        actorUserId: actor.user.id,
        actorLabel,
        notes: notes || null,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: workOrder.assetId,
        eventType: "REPAIR_WAITING_PARTS",
        fromStatus: workOrder.asset.status,
        toStatus: "REPAIR",
        actor: actorLabel,
        notes: notes || "Repair pending required parts.",
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}

export async function markPartReceived(
  partId: string,
  formData: FormData
) {
  const actor = await actorForPart(partId);
  const actorLabel = actor.label;


  const result = await prisma.$transaction(async (tx) => {
    const part = await tx.workOrderPart.findUnique({
      where: { id: partId },
      include: { workOrder: true },
    });

    if (!part) {
      throw new Error("Part not found.");
    }

    if (part.status === "RECEIVED") {
      return { workOrderId: part.workOrderId };
    }

    await tx.workOrderPart.update({
      where: { id: partId },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: part.workOrderId,
        eventType: "PART_RECEIVED",
        fromStatus: part.workOrder.status,
        toStatus: part.workOrder.status,
        actorUserId: actor.user.id,
        actorLabel,
        notes: `${part.quantity} x ${part.description} received.`,
      },
    });

    return { workOrderId: part.workOrderId };
  });

  await revalidateWorkOrder(result.workOrderId);
}

export async function resumeRepair(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const actorLabel = actor.label;
  const notes = String(formData.get("notes") ?? "").trim();


  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    assertCanResumeRepair(workOrder.status);

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { status: "IN_PROGRESS" },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType: "REPAIR_RESUMED",
        fromStatus: "WAITING_PARTS",
        toStatus: "IN_PROGRESS",
        actorUserId: actor.user.id,
        actorLabel,
        notes: notes || null,
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}


export async function markPartInstalled(
  partId: string,
  formData: FormData
) {
  const actor = await actorForPart(partId);
  const actorLabel = actor.label;
  const notes = String(formData.get("notes") ?? "").trim();


  const result = await prisma.$transaction(async (tx) => {
    const part = await tx.workOrderPart.findUnique({
      where: { id: partId },
      include: { workOrder: true },
    });

    if (!part) {
      throw new Error("Part not found.");
    }

    if (part.status !== "RECEIVED") {
      throw new Error(
        "Only a received part can be marked installed."
      );
    }

    await tx.workOrderPart.update({
      where: { id: partId },
      data: {
        status: "INSTALLED",
        installedAt: new Date(),
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: part.workOrderId,
        eventType: "PART_INSTALLED",
        fromStatus: part.workOrder.status,
        toStatus: part.workOrder.status,
        actorUserId: actor.user.id,
        actorLabel,
        notes: [
          `${part.quantity} x ${part.description} installed.`,
          notes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return { workOrderId: part.workOrderId };
  });

  await revalidateWorkOrder(result.workOrderId);
}

export async function completeRepairForTesting(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const actorLabel = actor.label;
  const resolution = String(
    formData.get("resolution") ?? ""
  ).trim();


  if (!resolution) {
    throw new Error("Repair resolution is required.");
  }

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        asset: true,
        activities: {
          where: { endedAt: null },
        },
        parts: true,
      },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    assertCanCompleteRepair({
      status: workOrder.status,
      hasActiveActivity: workOrder.activities.length > 0,
      partStatuses: workOrder.parts.map((part) => part.status),
    });

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: "TESTING",
        resolution,
      },
    });

    await tx.asset.update({
      where: { id: workOrder.assetId },
      data: { status: "TESTING" },
    });

    await tx.assetObservation.create({
      data: {
        assetId: workOrder.assetId,
        workOrderId,
        observerUserId: actor.user.id,
        observerLabel: actorLabel,
        observationType: "repair completion",
        condition: "TEST_PENDING",
        notes: resolution,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType: "REPAIR_COMPLETED",
        fromStatus: workOrder.status,
        toStatus: "TESTING",
        actorUserId: actor.user.id,
        actorLabel,
        notes: resolution,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: workOrder.assetId,
        eventType: "REPAIR_COMPLETED",
        fromStatus: workOrder.asset.status,
        toStatus: "TESTING",
        actor: actorLabel,
        notes: resolution,
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}

export async function recordQaResult(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const actorLabel = actor.label;
  const result = String(
    formData.get("result") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();


  if (!["PASS", "FAIL"].includes(result)) {
    throw new Error("QA result must be PASS or FAIL.");
  }

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        asset: true,
        activities: {
          where: { endedAt: null },
        },
      },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    assertCanRecordQa({
      status: workOrder.status,
      hasActiveActivity: workOrder.activities.length > 0,
    });

    const transition = qaTransition(result);
    const nextWorkOrderStatus = transition.workOrderStatus;
    const nextAssetStatus = transition.assetStatus;
    const condition = transition.condition;
    const eventType = transition.eventType;

    await tx.assetObservation.create({
      data: {
        assetId: workOrder.assetId,
        workOrderId,
        observerUserId: actor.user.id,
        observerLabel: actorLabel,
        observationType: "quality assurance",
        condition,
        notes: notes || null,
      },
    });

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: nextWorkOrderStatus,
      },
    });

    await tx.asset.update({
      where: { id: workOrder.assetId },
      data: {
        status: nextAssetStatus,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType,
        fromStatus: "TESTING",
        toStatus: nextWorkOrderStatus,
        actorUserId: actor.user.id,
        actorLabel,
        notes: notes || null,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: workOrder.assetId,
        eventType,
        fromStatus: workOrder.asset.status,
        toStatus: nextAssetStatus,
        actor: actorLabel,
        notes: notes || null,
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}


export async function packReadyAsset(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const actorLabel = actor.label;
  const notes = String(formData.get("notes") ?? "").trim();


  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        activities: {
          where: { endedAt: null },
        },
      },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    assertCanPack({
      status: workOrder.status,
      hasActiveActivity: workOrder.activities.length > 0,
    });

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { status: "PACKED" },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType: "PACKED",
        fromStatus: "READY",
        toStatus: "PACKED",
        actorUserId: actor.user.id,
        actorLabel,
        notes: notes || "Asset packed for outbound shipment.",
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}

export async function createOutboundShipment(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId, "shipment.manage");
  const actorLabel = actor.label;
  const carrier = String(formData.get("carrier") ?? "").trim();
  const trackingNumber = String(
    formData.get("trackingNumber") ?? ""
  ).trim();
  const destinationEndpointId = String(
    formData.get("destinationEndpointId") ?? ""
  ).trim();

  if (
    !actorLabel ||
    !carrier ||
    !trackingNumber ||
    !destinationEndpointId
  ) {
    throw new Error(
      "Operator, carrier, tracking number, and destination endpoint are required."
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        asset: true,
        serviceRequest: {
          include: {
            shipments: {
              where: { direction: "OUTBOUND" },
            },
          },
        },
      },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    assertCanCreateOutbound({
      workOrderStatus: workOrder.status,
      hasServiceRequest: Boolean(workOrder.serviceRequest),
      existingOutboundCount:
        workOrder.serviceRequest?.shipments.length ?? 0,
    });

    if (!workOrder.serviceRequest) {
      throw new Error(
        "Outbound shipment requires a linked service request."
      );
    }

    const destination = await tx.endpoint.findUnique({
      where: { id: destinationEndpointId },
    });

    if (!destination || !destination.isActive) {
      throw new Error("Destination endpoint not found or inactive.");
    }

    const ownerOrganizationId =
      workOrder.asset.ownerOrganizationId ??
      workOrder.asset.organizationId;

    if (destination.organizationId !== ownerOrganizationId) {
      throw new Error(
        "Outbound destination must belong to the asset owner/account organization."
      );
    }

    const originServiceLocationId =
      workOrder.asset.currentStoragePositionId
        ? (
            await tx.storagePosition.findUnique({
              where: { id: workOrder.asset.currentStoragePositionId },
              select: { serviceLocationId: true },
            })
          )?.serviceLocationId ?? null
        : null;

    const shipment = await tx.shipment.create({
      data: {
        serviceRequestId: workOrder.serviceRequest.id,
        direction: "OUTBOUND",
        originEndpointId: workOrder.asset.currentEndpointId,
        originServiceLocationId,
        destinationEndpointId,
        carrier,
        trackingNumber,
        status: "TRACKING_ENTERED",
        packages: {
          create: {
            packageCode: "OUT-1",
            trackingNumber,
            status: "EXPECTED",
            contents: {
              create: {
                assetId: workOrder.assetId,
                description: "Outbound serviced asset",
                quantity: 1,
                expected: true,
              },
            },
          },
        },
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId,
        eventType: "OUTBOUND_SHIPMENT_PREPARED",
        fromStatus: "PACKED",
        toStatus: "PACKED",
        actorUserId: actor.user.id,
        actorLabel,
        notes: `Outbound shipment prepared via ${carrier}; tracking ${trackingNumber}; destination ${destination.name}.`,
      },
    });

    return {
      workOrderId,
      serviceRequestId: workOrder.serviceRequest.id,
      shipmentId: shipment.id,
    };
  });

  revalidatePath(`/work-orders/${result.workOrderId}`);
  revalidatePath(
    `/service-requests/${result.serviceRequestId}`
  );
}

export async function markOutboundShipmentAccepted(
  shipmentId: string,
  formData: FormData
) {
  const actor = await actorForShipment(shipmentId);
  const actorLabel = actor.label;

  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        destinationEndpoint: true,
        destinationSite: true,
        serviceRequest: {
          include: {
            asset: {
              include: {
                ownerOrganization: true,
              },
            },
            workOrders: true,
          },
        },
      },
    });

    if (!shipment) {
      throw new Error("Shipment not found.");
    }

    if (
      shipment.direction === "OUTBOUND" &&
      shipment.status === "IN_TRANSIT"
    ) {
      const existingWorkOrder =
        shipment.serviceRequest.workOrders[0] ?? null;
      return {
        workOrderId: existingWorkOrder?.id ?? null,
        serviceRequestId: shipment.serviceRequestId,
      };
    }

    const asset = shipment.serviceRequest.asset;
    const workOrder =
      shipment.serviceRequest.workOrders.find(
        (candidate) => candidate.assetId === asset?.id
      ) ?? null;

    if (!asset || !workOrder) {
      throw new Error(
        "Outbound shipment requires a linked asset and work order."
      );
    }

    assertCanAcceptOutbound({
      direction: shipment.direction,
      shipmentStatus: shipment.status,
      workOrderStatus: workOrder.status,
    });

    const now = new Date();
    const carrierLabel = shipment.carrier ?? "Outbound carrier";
    const destinationLabel =
      shipment.destinationEndpoint?.name ??
      shipment.destinationSite?.name ??
      "customer destination";

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "IN_TRANSIT",
        acceptedAt: now,
        shippedAt: shipment.shippedAt ?? now,
      },
    });

    await tx.package.updateMany({
      where: { shipmentId: shipment.id },
      data: { status: "IN_TRANSIT" },
    });

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: { status: "OUTBOUND" },
    });

    await tx.assetMovement.create({
      data: {
        assetId: asset.id,
        actorUserId: actor.user.id,
        fromEndpointId: asset.currentEndpointId,
        fromStoragePositionId: asset.currentStoragePositionId,
        toEndpointId: null,
        toStoragePositionId: null,
        fromCustodyType: asset.currentCustodyType,
        toCustodyType: "CARRIER",
        fromCustodianLabel: asset.currentCustodianLabel,
        toCustodianLabel: carrierLabel,
        reason: shipment.trackingNumber
          ? `Outbound carrier acceptance to ${destinationLabel}; tracking ${shipment.trackingNumber}.`
          : `Outbound carrier acceptance to ${destinationLabel}.`,
        occurredAt: now,
      },
    });

    await tx.asset.update({
      where: { id: asset.id },
      data: {
        status: "DISPATCHED",
        currentCustodyType: "CARRIER",
        currentCustodianLabel: carrierLabel,
        currentEndpointId: null,
        currentStoragePositionId: null,
        currentStorageLocationId: null,
        siteId: null,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        eventType: "OUTBOUND_CARRIER_ACCEPTED",
        fromStatus: "PACKED",
        toStatus: "OUTBOUND",
        actorUserId: actor.user.id,
        actorLabel,
        notes: `${shipment.carrier ?? "Carrier"} accepted outbound shipment ${shipment.trackingNumber ?? ""}; destination ${destinationLabel}.`,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "DISPATCHED_TO_CUSTOMER",
        fromStatus: asset.status,
        toStatus: "DISPATCHED",
        actor: actorLabel,
        notes: `Outbound to ${destinationLabel} via ${shipment.carrier ?? "carrier"}; tracking ${shipment.trackingNumber ?? "not recorded"}.`,
      },
    });

    return {
      workOrderId: workOrder.id,
      serviceRequestId: shipment.serviceRequestId,
    };
  });

  if (result.workOrderId) {
    revalidatePath(`/work-orders/${result.workOrderId}`);
  }
  revalidatePath(
    `/service-requests/${result.serviceRequestId}`
  );
}

export async function confirmOutboundDelivery(
  shipmentId: string,
  formData: FormData
) {
  const actor = await actorForShipment(shipmentId);
  const actorLabel = actor.label;
  const notes = String(formData.get("notes") ?? "").trim();

  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        destinationEndpoint: true,
        destinationSite: true,
        serviceRequest: {
          include: {
            asset: {
              include: {
                ownerOrganization: true,
              },
            },
            workOrders: true,
          },
        },
      },
    });

    if (!shipment) {
      throw new Error("Shipment not found.");
    }

    const asset = shipment.serviceRequest.asset;
    const workOrder =
      shipment.serviceRequest.workOrders.find(
        (candidate) => candidate.assetId === asset?.id
      ) ?? null;

    if (!asset || !workOrder) {
      throw new Error(
        "Outbound shipment requires a linked asset and work order."
      );
    }

    assertCanConfirmDelivery({
      direction: shipment.direction,
      shipmentStatus: shipment.status,
      workOrderStatus: workOrder.status,
    });

    const now = new Date();
    const destinationLabel =
      shipment.destinationEndpoint?.name ??
      shipment.destinationSite?.name ??
      "customer destination";

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "DELIVERED",
        deliveredAt: now,
      },
    });

    await tx.package.updateMany({
      where: { shipmentId: shipment.id },
      data: { status: "DELIVERED" },
    });

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
        closedAt: now,
      },
    });

    await tx.serviceRequest.update({
      where: { id: shipment.serviceRequestId },
      data: { status: "COMPLETED" },
    });

    await tx.assetMovement.create({
      data: {
        assetId: asset.id,
        actorUserId: actor.user.id,
        fromEndpointId: asset.currentEndpointId,
        fromStoragePositionId: asset.currentStoragePositionId,
        toEndpointId: shipment.destinationEndpointId,
        toStoragePositionId: null,
        fromCustodyType: asset.currentCustodyType,
        toCustodyType: "CUSTOMER",
        fromCustodianLabel: asset.currentCustodianLabel,
        toCustodianLabel: destinationLabel,
        reason: [
          `Carrier delivery confirmed at ${destinationLabel}.`,
          notes || null,
        ]
          .filter(Boolean)
          .join(" "),
        occurredAt: now,
      },
    });

    await tx.asset.update({
      where: { id: asset.id },
      data: {
        status: "DELIVERED",
        currentCustodyType: "CUSTOMER",
        currentCustodianLabel: destinationLabel,
        currentEndpointId: shipment.destinationEndpointId,
        currentStoragePositionId: null,
        currentStorageLocationId: null,
        siteId: shipment.destinationSiteId,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        eventType: "DELIVERED_TO_CUSTOMER",
        fromStatus: "OUTBOUND",
        toStatus: "COMPLETED",
        actorUserId: actor.user.id,
        actorLabel,
        notes: [
          `Delivered to ${destinationLabel}.`,
          notes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "DELIVERED_TO_CUSTOMER",
        fromStatus: asset.status,
        toStatus: "DELIVERED",
        actor: actorLabel,
        notes: [
          `Customer custody resumed at ${destinationLabel}.`,
          notes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return {
      workOrderId: workOrder.id,
      serviceRequestId: shipment.serviceRequestId,
      assetId: asset.id,
    };
  });

  revalidatePath(`/work-orders/${result.workOrderId}`);
  revalidatePath(
    `/service-requests/${result.serviceRequestId}`
  );
  revalidatePath(`/assets/${result.assetId}`);
}

export async function acknowledgeCustomerReceipt(
  shipmentId: string,
  formData: FormData
) {
  const actor = await actorForShipment(
    shipmentId,
    "shipment.acknowledge_receipt"
  );
  const recipientLabel = String(
    formData.get("recipientLabel") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!recipientLabel) {
    throw new Error("Customer recipient name or label is required.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        serviceRequest: {
          include: {
            asset: true,
            workOrders: true,
          },
        },
        destinationEndpoint: true,
        destinationSite: true,
      },
    });

    if (!shipment) {
      throw new Error("Shipment not found.");
    }

    assertCanAcknowledgeReceipt({
      direction: shipment.direction,
      shipmentStatus: shipment.status,
    });

    if (shipment.customerAcknowledgedAt) {
      const existingWorkOrder =
        shipment.serviceRequest.workOrders[0] ?? null;

      return {
        workOrderId: existingWorkOrder?.id ?? null,
        serviceRequestId: shipment.serviceRequestId,
        assetId: shipment.serviceRequest.assetId ?? null,
      };
    }

    const asset = shipment.serviceRequest.asset;
    const workOrder =
      shipment.serviceRequest.workOrders.find(
        (candidate) => candidate.assetId === asset?.id
      ) ?? null;

    if (!asset || !workOrder) {
      throw new Error(
        "Outbound delivery acknowledgment requires a linked asset and work order."
      );
    }

    const acknowledgedAt = new Date();
    const destinationLabel =
      shipment.destinationEndpoint?.name ??
      shipment.destinationSite?.name ??
      "customer destination";

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        customerAcknowledgedAt: acknowledgedAt,
        customerAcknowledgedByLabel: recipientLabel,
        customerAcknowledgmentNotes: notes || null,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        eventType: "CUSTOMER_RECEIPT_ACKNOWLEDGED",
        fromStatus: workOrder.status,
        toStatus: workOrder.status,
        actorUserId: actor.user.id,
        actorLabel: actor.label,
        notes: [
          `Customer receipt acknowledged by ${recipientLabel} at ${destinationLabel}.`,
          notes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "CUSTOMER_RECEIPT_ACKNOWLEDGED",
        fromStatus: asset.status,
        toStatus: asset.status,
        actor: actor.label,
        notes: [
          `Receipt acknowledged at ${destinationLabel}.`,
          notes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return {
      workOrderId: workOrder.id,
      serviceRequestId: shipment.serviceRequestId,
      assetId: asset.id,
    };
  });

  if (result.workOrderId) {
    revalidatePath(`/work-orders/${result.workOrderId}`);
  }
  revalidatePath(
    `/service-requests/${result.serviceRequestId}`
  );
  if (result.assetId) {
    revalidatePath(`/assets/${result.assetId}`);
  }
}



export async function setWorkOrderWaitingExternalService(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const provider = String(
    formData.get("externalServiceProvider") ?? ""
  ).trim();
  const rmaReference = String(
    formData.get("externalRmaReference") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const destinationName = String(
    formData.get("destinationName") ?? ""
  ).trim();
  const addressLine1 = String(
    formData.get("addressLine1") ?? ""
  ).trim();
  const addressLine2 = String(
    formData.get("addressLine2") ?? ""
  ).trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(
    formData.get("postalCode") ?? ""
  ).trim();
  const country = String(
    formData.get("country") ?? "US"
  ).trim() || "US";
  const expectedReturnAtRaw = String(
    formData.get("expectedReturnAt") ?? ""
  ).trim();
  const expectedReturnAt = expectedReturnAtRaw
    ? new Date(expectedReturnAtRaw)
    : null;

  if (
    expectedReturnAt &&
    Number.isNaN(expectedReturnAt.getTime())
  ) {
    throw new Error("Expected return date is invalid.");
  }

  if (!provider) {
    throw new Error("External service provider is required.");
  }

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        asset: true,
        serviceRequest: true,
        activities: {
          where: { endedAt: null },
        },
      },
    });

    if (!workOrder || !workOrder.serviceRequest) {
      throw new Error(
        "Work order must be linked to a service request."
      );
    }

    if (workOrder.activities.length > 0) {
      throw new Error(
        "Stop the active labor/activity timer before routing to external service."
      );
    }

    assertCanWaitForExternalService(workOrder.status);

    await tx.serviceRequest.update({
      where: { id: workOrder.serviceRequest.id },
      data: {
        externalServiceProvider: provider,
        externalRmaReference: rmaReference || null,
      },
    });

    const existingCase = await tx.externalServiceCase.findFirst({
      where: {
        workOrderId: workOrder.id,
        status: {
          notIn: ["RETURNED", "CANCELLED"],
        },
      },
    });

    if (existingCase) {
      throw new Error(
        "This work order already has an active external service case."
      );
    }

    await tx.externalServiceCase.create({
      data: {
        serviceRequestId: workOrder.serviceRequest.id,
        workOrderId: workOrder.id,
        assetId: workOrder.assetId,
        providerName: provider,
        providerCaseReference: rmaReference || null,
        destinationName: destinationName || provider,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        postalCode: postalCode || null,
        country,
        expectedReturnAt,
        notes: notes || null,
      },
    });

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: { status: "WAITING_EXTERNAL_SERVICE" },
    });

    await tx.asset.update({
      where: { id: workOrder.assetId },
      data: { status: "REPAIR" },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        eventType: "EXTERNAL_SERVICE_INITIATED",
        fromStatus: workOrder.status,
        toStatus: "WAITING_EXTERNAL_SERVICE",
        actorUserId: actor.user.id,
        actorLabel: actor.label,
        notes: [
          `External provider: ${provider}.`,
          rmaReference ? `RMA/case: ${rmaReference}.` : null,
          notes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: workOrder.assetId,
        eventType: "EXTERNAL_SERVICE_INITIATED",
        fromStatus: workOrder.asset.status,
        toStatus: "REPAIR",
        actor: actor.label,
        notes: [
          `External provider: ${provider}.`,
          rmaReference ? `RMA/case: ${rmaReference}.` : null,
          notes || null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}

export async function resumeAfterExternalService(
  workOrderId: string,
  formData: FormData
) {
  const actor = await actorForWorkOrder(workOrderId);
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: { asset: true },
    });

    if (!workOrder) {
      throw new Error("Work order not found.");
    }

    assertCanResumeFromExternalService(workOrder.status);

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: { status: "TESTING" },
    });

    await tx.asset.update({
      where: { id: workOrder.assetId },
      data: { status: "TESTING" },
    });

    await tx.assetObservation.create({
      data: {
        assetId: workOrder.assetId,
        workOrderId: workOrder.id,
        observerUserId: actor.user.id,
        observerLabel: actor.label,
        observationType: "external service return",
        condition: "TEST_PENDING",
        notes:
          notes ||
          "Asset returned from external service and requires verification.",
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        eventType: "EXTERNAL_SERVICE_RETURNED",
        fromStatus: "WAITING_EXTERNAL_SERVICE",
        toStatus: "TESTING",
        actorUserId: actor.user.id,
        actorLabel: actor.label,
        notes:
          notes ||
          "Asset returned from external service and moved to verification.",
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: workOrder.assetId,
        eventType: "EXTERNAL_SERVICE_RETURNED",
        fromStatus: workOrder.asset.status,
        toStatus: "TESTING",
        actor: actor.label,
        notes:
          notes ||
          "Asset returned from external service and moved to verification.",
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}
