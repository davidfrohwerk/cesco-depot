export type WorkOrderStatusValue =
  | "IN_TRANSIT"
  | "AWAITING_RECEIPT"
  | "RECEIVED"
  | "INTAKE"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_PARTS"
  | "WAITING_CUSTOMER_AUTHORIZATION"
  | "WAITING_EXTERNAL_SERVICE"
  | "TESTING"
  | "READY"
  | "PACKED"
  | "OUTBOUND"
  | "COMPLETED"
  | "CANCELLED";

export type ShipmentDirectionValue =
  | "INBOUND"
  | "OUTBOUND"
  | "TRANSFER";

export type ShipmentStatusValue =
  | "PREPARING"
  | "LABEL_CREATED"
  | "TRACKING_ENTERED"
  | "IN_TRANSIT"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "DELIVERED"
  | "EXCEPTION"
  | "CANCELLED";

export type PartStatusValue =
  | "REQUIRED"
  | "ORDERED"
  | "BACKORDERED"
  | "RECEIVED"
  | "INSTALLED"
  | "REMOVED"
  | "RETURNED"
  | "CONSUMED"
  | "CANCELLED";

export function assertCanBeginIntake(
  status: WorkOrderStatusValue
): void;

export function assertCanWaitForParts(
  status: WorkOrderStatusValue
): void;

export function assertCanResumeRepair(
  status: WorkOrderStatusValue
): void;

export function assertCanWaitForExternalService(
  status: WorkOrderStatusValue
): void;

export function assertCanResumeFromExternalService(
  status: WorkOrderStatusValue
): void;

export function assertCanCompleteRepair(args: {
  status: WorkOrderStatusValue;
  hasActiveActivity: boolean;
  partStatuses: PartStatusValue[];
}): void;

export function assertCanRecordQa(args: {
  status: WorkOrderStatusValue;
  hasActiveActivity: boolean;
}): void;

export function qaTransition(
  result: string
):
  | {
      workOrderStatus: "READY";
      assetStatus: "READY";
      condition: "KNOWN_GOOD";
      eventType: "TEST_PASSED";
    }
  | {
      workOrderStatus: "IN_PROGRESS";
      assetStatus: "REPAIR";
      condition: "FAILED";
      eventType: "TEST_FAILED";
    };

export function assertCanPack(args: {
  status: WorkOrderStatusValue;
  hasActiveActivity: boolean;
}): void;

export function assertCanCreateOutbound(args: {
  workOrderStatus: WorkOrderStatusValue;
  hasServiceRequest: boolean;
  existingOutboundCount: number;
}): void;

export function assertCanAcceptOutbound(args: {
  direction: ShipmentDirectionValue;
  shipmentStatus: ShipmentStatusValue;
  workOrderStatus: WorkOrderStatusValue;
}): void;

export function assertCanConfirmDelivery(args: {
  direction: ShipmentDirectionValue;
  shipmentStatus: ShipmentStatusValue;
  workOrderStatus: WorkOrderStatusValue;
}): void;

export function assertCanAcknowledgeReceipt(args: {
  direction: ShipmentDirectionValue;
  shipmentStatus: ShipmentStatusValue;
}): void;
