import test from "node:test";
import assert from "node:assert/strict";
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
} from "../src/lib/workflow-rules.js";

test("happy-path lifecycle reaches delivered customer custody boundary", () => {
  assert.doesNotThrow(() => assertCanBeginIntake("RECEIVED"));

  assert.doesNotThrow(() =>
    assertCanCompleteRepair({
      status: "IN_PROGRESS",
      hasActiveActivity: false,
      partStatuses: ["INSTALLED"],
    })
  );

  assert.doesNotThrow(() =>
    assertCanRecordQa({
      status: "TESTING",
      hasActiveActivity: false,
    })
  );

  assert.deepEqual(qaTransition("PASS"), {
    workOrderStatus: "READY",
    assetStatus: "READY",
    condition: "KNOWN_GOOD",
    eventType: "TEST_PASSED",
  });

  assert.doesNotThrow(() =>
    assertCanPack({
      status: "READY",
      hasActiveActivity: false,
    })
  );

  assert.doesNotThrow(() =>
    assertCanCreateOutbound({
      workOrderStatus: "PACKED",
      hasServiceRequest: true,
      existingOutboundCount: 0,
    })
  );

  assert.doesNotThrow(() =>
    assertCanAcceptOutbound({
      direction: "OUTBOUND",
      shipmentStatus: "TRACKING_ENTERED",
      workOrderStatus: "PACKED",
    })
  );

  assert.doesNotThrow(() =>
    assertCanConfirmDelivery({
      direction: "OUTBOUND",
      shipmentStatus: "IN_TRANSIT",
      workOrderStatus: "OUTBOUND",
    })
  );

  assert.doesNotThrow(() =>
    assertCanAcknowledgeReceipt({
      direction: "OUTBOUND",
      shipmentStatus: "DELIVERED",
    })
  );
});

test("repair cannot complete with active labor", () => {
  assert.throws(
    () =>
      assertCanCompleteRepair({
        status: "IN_PROGRESS",
        hasActiveActivity: true,
        partStatuses: [],
      }),
    /Stop the active labor/
  );
});

test("repair cannot complete with unresolved parts", () => {
  for (const status of ["REQUIRED", "ORDERED", "BACKORDERED"]) {
    assert.throws(
      () =>
        assertCanCompleteRepair({
          status: "IN_PROGRESS",
          hasActiveActivity: false,
          partStatuses: [status],
        }),
      /Resolve required or outstanding parts/
    );
  }
});

test("QA fail returns asset to repair rather than ready", () => {
  assert.deepEqual(qaTransition("FAIL"), {
    workOrderStatus: "IN_PROGRESS",
    assetStatus: "REPAIR",
    condition: "FAILED",
    eventType: "TEST_FAILED",
  });
});

test("packing requires READY and no active timer", () => {
  assert.throws(
    () =>
      assertCanPack({
        status: "TESTING",
        hasActiveActivity: false,
      }),
    /Only a READY/
  );

  assert.throws(
    () =>
      assertCanPack({
        status: "READY",
        hasActiveActivity: true,
      }),
    /Stop the active labor/
  );
});

test("outbound shipment cannot be duplicated", () => {
  assert.throws(
    () =>
      assertCanCreateOutbound({
        workOrderStatus: "PACKED",
        hasServiceRequest: true,
        existingOutboundCount: 1,
      }),
    /already exists/
  );
});

test("carrier acceptance preserves shipment direction semantics", () => {
  assert.throws(
    () =>
      assertCanAcceptOutbound({
        direction: "INBOUND",
        shipmentStatus: "TRACKING_ENTERED",
        workOrderStatus: "PACKED",
      }),
    /not outbound/
  );
});

test("delivery requires both shipment and work order to be outbound", () => {
  assert.throws(
    () =>
      assertCanConfirmDelivery({
        direction: "OUTBOUND",
        shipmentStatus: "TRACKING_ENTERED",
        workOrderStatus: "PACKED",
      }),
    /in-transit outbound shipment/
  );

  assert.throws(
    () =>
      assertCanConfirmDelivery({
        direction: "OUTBOUND",
        shipmentStatus: "IN_TRANSIT",
        workOrderStatus: "PACKED",
      }),
    /must be OUTBOUND/
  );
});

test("customer receipt cannot precede carrier delivery", () => {
  assert.throws(
    () =>
      assertCanAcknowledgeReceipt({
        direction: "OUTBOUND",
        shipmentStatus: "IN_TRANSIT",
      }),
    /after carrier delivery/
  );
});

test("waiting-parts branch has controlled entry and exit", () => {
  assert.doesNotThrow(() => assertCanWaitForParts("IN_PROGRESS"));
  assert.doesNotThrow(() => assertCanResumeRepair("WAITING_PARTS"));
  assert.throws(() => assertCanResumeRepair("READY"), /waiting for parts/);
});


test("external-service branch has controlled entry and exit", () => {
  assert.doesNotThrow(() => assertCanWaitForExternalService("INTAKE"));
  assert.doesNotThrow(() => assertCanWaitForExternalService("IN_PROGRESS"));
  assert.throws(
    () => assertCanWaitForExternalService("READY"),
    /external service provider/
  );

  assert.doesNotThrow(() =>
    assertCanResumeFromExternalService("WAITING_EXTERNAL_SERVICE")
  );
  assert.throws(
    () => assertCanResumeFromExternalService("IN_PROGRESS"),
    /waiting for external service/
  );
});
