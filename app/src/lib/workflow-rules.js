export const unresolvedPartStatuses = new Set([
  "REQUIRED",
  "ORDERED",
  "BACKORDERED",
]);

export function assertCanBeginIntake(status) {
  if (status !== "RECEIVED") {
    throw new Error("Work order must be RECEIVED before intake begins.");
  }
}

export function assertCanWaitForParts(status) {
  if (!["INTAKE", "OPEN", "IN_PROGRESS"].includes(status)) {
    throw new Error(
      "Work order is not in a state that can wait for parts."
    );
  }
}

export function assertCanResumeRepair(status) {
  if (status !== "WAITING_PARTS") {
    throw new Error(
      "Only a work order waiting for parts can resume repair."
    );
  }
}

export function assertCanCompleteRepair({
  status,
  hasActiveActivity,
  partStatuses,
}) {
  if (!["INTAKE", "OPEN", "IN_PROGRESS"].includes(status)) {
    throw new Error(
      "Work order is not in a repair state that can move to testing."
    );
  }

  if (hasActiveActivity) {
    throw new Error(
      "Stop the active labor/activity timer before completing repair."
    );
  }

  if (partStatuses.some((status) => unresolvedPartStatuses.has(status))) {
    throw new Error(
      "Resolve required or outstanding parts before completing repair."
    );
  }
}

export function qaTransition(result) {
  if (result === "PASS") {
    return {
      workOrderStatus: "READY",
      assetStatus: "READY",
      condition: "KNOWN_GOOD",
      eventType: "TEST_PASSED",
    };
  }

  if (result === "FAIL") {
    return {
      workOrderStatus: "IN_PROGRESS",
      assetStatus: "REPAIR",
      condition: "FAILED",
      eventType: "TEST_FAILED",
    };
  }

  throw new Error("QA result must be PASS or FAIL.");
}

export function assertCanRecordQa({ status, hasActiveActivity }) {
  if (status !== "TESTING") {
    throw new Error(
      "QA results can only be recorded while the work order is TESTING."
    );
  }

  if (hasActiveActivity) {
    throw new Error(
      "Stop the active labor/activity timer before recording the QA result."
    );
  }
}

export function assertCanPack({ status, hasActiveActivity }) {
  if (status !== "READY") {
    throw new Error("Only a READY work order can be packed.");
  }

  if (hasActiveActivity) {
    throw new Error(
      "Stop the active labor/activity timer before packing."
    );
  }
}

export function assertCanCreateOutbound({
  workOrderStatus,
  hasServiceRequest,
  existingOutboundCount,
}) {
  if (workOrderStatus !== "PACKED") {
    throw new Error(
      "Work order must be PACKED before outbound shipment setup."
    );
  }

  if (!hasServiceRequest) {
    throw new Error(
      "Outbound shipment requires a linked service request."
    );
  }

  if (existingOutboundCount > 0) {
    throw new Error(
      "An outbound shipment already exists for this service request."
    );
  }
}

export function assertCanAcceptOutbound({
  direction,
  shipmentStatus,
  workOrderStatus,
}) {
  if (direction !== "OUTBOUND") {
    throw new Error("Shipment is not outbound.");
  }

  if (shipmentStatus !== "TRACKING_ENTERED") {
    throw new Error(
      "Outbound tracking must be entered before carrier acceptance."
    );
  }

  if (workOrderStatus !== "PACKED") {
    throw new Error(
      "Work order must be PACKED before outbound carrier acceptance."
    );
  }
}

export function assertCanConfirmDelivery({
  direction,
  shipmentStatus,
  workOrderStatus,
}) {
  if (direction !== "OUTBOUND") {
    throw new Error("Shipment is not outbound.");
  }

  if (shipmentStatus !== "IN_TRANSIT") {
    throw new Error(
      "Only an in-transit outbound shipment can be delivered."
    );
  }

  if (workOrderStatus !== "OUTBOUND") {
    throw new Error(
      "Work order must be OUTBOUND before delivery confirmation."
    );
  }
}

export function assertCanAcknowledgeReceipt({
  direction,
  shipmentStatus,
}) {
  if (direction !== "OUTBOUND") {
    throw new Error("Shipment is not outbound.");
  }

  if (shipmentStatus !== "DELIVERED") {
    throw new Error(
      "Customer receipt can only be acknowledged after carrier delivery."
    );
  }
}
