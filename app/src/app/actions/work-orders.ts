"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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

export async function beginWorkOrderIntake(
  workOrderId: string,
  formData: FormData
) {
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!actorLabel) {
    throw new Error("Operator name or label is required.");
  }

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
  const observerLabel = String(
    formData.get("observerLabel") ?? ""
  ).trim();
  const observationType = String(
    formData.get("observationType") ?? ""
  ).trim();
  const condition = String(
    formData.get("condition") ?? "UNKNOWN"
  ).trim() as AssetCondition;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!observerLabel) {
    throw new Error("Observer name or label is required.");
  }

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
  const workerLabel = String(
    formData.get("workerLabel") ?? ""
  ).trim();
  const activityType = String(
    formData.get("activityType") ?? ""
  ).trim() as WorkActivityType;
  const notes = String(formData.get("notes") ?? "").trim();
  const billable = formData.get("billable") === "on";
  const training = formData.get("training") === "on";
  const supervised = formData.get("supervised") === "on";

  if (!workerLabel || !activityType) {
    throw new Error(
      "Worker label and activity type are required."
    );
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
        actorLabel: workerLabel,
        notes: `${activity.activityType} activity started.`,
      },
    });
  });

  await revalidateWorkOrder(workOrderId);
}

export async function stopWorkActivity(activityId: string) {
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
        actorLabel: activity.workerLabel,
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
        actorLabel: "depot-dev",
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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!actorLabel) {
    throw new Error("Operator name or label is required.");
  }

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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();

  if (!actorLabel) {
    throw new Error("Operator name or label is required.");
  }

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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!actorLabel) {
    throw new Error("Operator name or label is required.");
  }

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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!actorLabel) {
    throw new Error("Operator name or label is required.");
  }

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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const resolution = String(
    formData.get("resolution") ?? ""
  ).trim();

  if (!actorLabel) {
    throw new Error("Operator name or label is required.");
  }

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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const result = String(
    formData.get("result") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!actorLabel) {
    throw new Error("Tester name or label is required.");
  }

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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!actorLabel) {
    throw new Error("Operator name or label is required.");
  }

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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const carrier = String(formData.get("carrier") ?? "").trim();
  const trackingNumber = String(
    formData.get("trackingNumber") ?? ""
  ).trim();
  const destinationSiteId = String(
    formData.get("destinationSiteId") ?? ""
  ).trim();

  if (
    !actorLabel ||
    !carrier ||
    !trackingNumber ||
    !destinationSiteId
  ) {
    throw new Error(
      "Operator, carrier, tracking number, and destination are required."
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

    const destination = await tx.site.findUnique({
      where: { id: destinationSiteId },
    });

    if (!destination) {
      throw new Error("Destination site not found.");
    }

    if (
      workOrder.asset.ownerOrganizationId &&
      destination.organizationId !==
        workOrder.asset.ownerOrganizationId
    ) {
      throw new Error(
        "Outbound destination must belong to the asset owner organization."
      );
    }

    const shipment = await tx.shipment.create({
      data: {
        serviceRequestId: workOrder.serviceRequest.id,
        direction: "OUTBOUND",
        originSiteId: workOrder.asset.siteId,
        destinationSiteId,
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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();

  if (!actorLabel) {
    throw new Error("Operator name or label is required.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
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

    await tx.asset.update({
      where: { id: asset.id },
      data: {
        status: "DISPATCHED",
        currentCustodyType: "CARRIER",
        currentCustodianLabel:
          shipment.carrier ?? "Outbound carrier",
        currentStorageLocationId: null,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        eventType: "OUTBOUND_CARRIER_ACCEPTED",
        fromStatus: "PACKED",
        toStatus: "OUTBOUND",
        actorLabel,
        notes: `${shipment.carrier ?? "Carrier"} accepted outbound shipment ${shipment.trackingNumber ?? ""}.`,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "DISPATCHED_TO_CUSTOMER",
        fromStatus: asset.status,
        toStatus: "DISPATCHED",
        actor: actorLabel,
        notes: `Outbound to ${shipment.destinationSite.name} via ${shipment.carrier ?? "carrier"}; tracking ${shipment.trackingNumber ?? "not recorded"}.`,
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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!actorLabel) {
    throw new Error("Operator name or label is required.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
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

    await tx.asset.update({
      where: { id: asset.id },
      data: {
        status: "DELIVERED",
        currentCustodyType: "CUSTOMER",
        currentCustodianLabel:
          asset.ownerOrganization?.name ?? "Customer",
        siteId: shipment.destinationSiteId,
        currentStorageLocationId: null,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        eventType: "DELIVERED_TO_CUSTOMER",
        fromStatus: "OUTBOUND",
        toStatus: "COMPLETED",
        actorLabel,
        notes: [
          `Delivered to ${shipment.destinationSite.name}.`,
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
          `Customer custody resumed at ${shipment.destinationSite.name}.`,
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
  const actorLabel = String(
    formData.get("actorLabel") ?? ""
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!actorLabel) {
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

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        customerAcknowledgedAt: acknowledgedAt,
        customerAcknowledgedByLabel: actorLabel,
        customerAcknowledgmentNotes: notes || null,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        eventType: "CUSTOMER_RECEIPT_ACKNOWLEDGED",
        fromStatus: workOrder.status,
        toStatus: workOrder.status,
        actorLabel,
        notes: [
          `Customer receipt acknowledged at ${shipment.destinationSite.name}.`,
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
        actor: actorLabel,
        notes: [
          `Receipt acknowledged at ${shipment.destinationSite.name}.`,
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
