import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addRequiredPart,
  beginWorkOrderIntake,
  completeRepairForTesting,
  confirmOutboundDelivery,
  createOutboundShipment,
  markOutboundShipmentAccepted,
  markPartInstalled,
  markPartReceived,
  recordAssetObservation,
  recordQaResult,
  resumeRepair,
  setWorkOrderWaitingParts,
  startWorkActivity,
  stopWorkActivity,
  packReadyAsset,
} from "@/app/actions/work-orders";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const assetConditions = [
  "UNKNOWN",
  "GOOD",
  "KNOWN_GOOD",
  "COSMETIC_DAMAGE",
  "SHIPPING_DAMAGE",
  "FAILED",
  "INTERMITTENT",
  "REPAIRABLE",
  "NONREPAIRABLE",
  "PARTS_ONLY",
  "DATA_BEARING",
  "TEST_PENDING",
] as const;

const activityTypes = [
  "RECEIVING",
  "INVENTORY_INTAKE",
  "INSPECTION",
  "DIAGNOSIS",
  "REPAIR",
  "TESTING",
  "CONFIGURATION",
  "PACKAGING",
  "LOGISTICS",
  "DATA_DESTRUCTION",
  "DECOMMISSIONING",
  "ADMINISTRATION",
  "TRAINING",
  "SUPERVISION",
  "OTHER",
] as const;

function moneyFromCents(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

export default async function WorkOrderPage({ params }: PageProps) {
  const { id } = await params;

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      asset: {
        include: {
          organization: true,
          ownerOrganization: true,
          currentStorageLocation: true,
        },
      },
      serviceRequest: true,
      shipment: {
        include: {
          destinationSite: true,
        },
      },
      events: {
        orderBy: { createdAt: "desc" },
      },
      activities: {
        orderBy: { startedAt: "desc" },
      },
      observations: {
        orderBy: { observedAt: "desc" },
      },
      parts: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!workOrder) {
    notFound();
  }

  const activeActivity =
    workOrder.activities.find((activity) => !activity.endedAt) ?? null;

  const totalLaborMinutes = workOrder.activities.reduce(
    (sum, activity) => sum + (activity.durationMinutes ?? 0),
    0
  );

  const outboundShipment = workOrder.serviceRequestId
    ? await prisma.shipment.findFirst({
        where: {
          serviceRequestId: workOrder.serviceRequestId,
          direction: "OUTBOUND",
        },
        include: {
          destinationSite: true,
          packages: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const customerSites = workOrder.asset.ownerOrganizationId
    ? await prisma.site.findMany({
        where: {
          organizationId: workOrder.asset.ownerOrganizationId,
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link
        href={
          workOrder.serviceRequestId
            ? `/service-requests/${workOrder.serviceRequestId}`
            : `/assets/${workOrder.assetId}`
        }
        className="text-sm underline"
      >
        ← Back
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm opacity-60">Work order</p>
          <h1 className="text-3xl font-bold">{workOrder.number}</h1>
          <p className="mt-2 opacity-70">
            {workOrder.asset.assetTag} ·{" "}
            {[workOrder.asset.manufacturer, workOrder.asset.model]
              .filter(Boolean)
              .join(" ") || "Unspecified hardware"}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="rounded border px-4 py-2 text-sm font-medium">
            Status: {workOrder.status}
          </div>
          {["RECEIVED", "READY", "PACKED", "OUTBOUND"].includes(
            workOrder.status
          ) && (
            <a
              href="#next-action"
              className="text-sm underline"
            >
              Go to next action
            </a>
          )}
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded border p-4">
          <h2 className="font-semibold">Ownership & custody</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="opacity-60">Owner</dt>
              <dd>
                {workOrder.asset.ownerOrganization?.name ??
                  "Not explicitly recorded"}
              </dd>
            </div>
            <div>
              <dt className="opacity-60">Custody</dt>
              <dd>
                {workOrder.asset.currentCustodyType ?? "—"}
                {workOrder.asset.currentCustodianLabel
                  ? ` — ${workOrder.asset.currentCustodianLabel}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="opacity-60">Location</dt>
              <dd>
                {workOrder.asset.currentStorageLocation?.name ?? "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded border p-4">
          <h2 className="font-semibold">Service</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="opacity-60">Type</dt>
              <dd>
                {workOrder.serviceType?.replaceAll("_", " ") ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="opacity-60">Reported issue</dt>
              <dd>{workOrder.reportedIssue ?? "—"}</dd>
            </div>
            <div>
              <dt className="opacity-60">Opened</dt>
              <dd>{workOrder.openedAt.toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded border p-4">
          <h2 className="font-semibold">Labor</h2>
          <div className="mt-4 text-3xl font-bold">
            {totalLaborMinutes}
          </div>
          <div className="text-sm opacity-60">recorded minutes</div>
          <div className="mt-3 text-sm">
            {activeActivity
              ? `Active: ${activeActivity.activityType.replaceAll("_", " ")} by ${activeActivity.workerLabel ?? "unidentified worker"}`
              : "No active activity timer"}
          </div>
        </div>
      </section>

      {workOrder.status === "RECEIVED" && (
        <section id="next-action" className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Begin depot intake
          </h2>
          <p className="mt-2 text-sm opacity-70">
            This starts the technical intake/inspection phase without
            pretending that repair has already occurred.
          </p>

          <form
            action={beginWorkOrderIntake.bind(null, workOrder.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input
              name="actorLabel"
              required
              placeholder="Operator name"
              className="rounded border px-3 py-2"
            />
            <input
              name="notes"
              placeholder="Optional intake note"
              className="rounded border px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
            >
              Begin intake / inspection
            </button>
          </form>
        </section>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded border p-5">
          <h2 className="text-xl font-semibold">
            Condition observation
          </h2>

          <form
            action={recordAssetObservation.bind(null, workOrder.id)}
            className="mt-5 space-y-3"
          >
            <input
              name="observerLabel"
              required
              placeholder="Observer name"
              className="w-full rounded border px-3 py-2"
            />

            <input
              name="observationType"
              placeholder="Observation type (inspection, damage, test...)"
              className="w-full rounded border px-3 py-2"
            />

            <select
              name="condition"
              defaultValue="UNKNOWN"
              className="w-full rounded border px-3 py-2"
            >
              {assetConditions.map((condition) => (
                <option key={condition} value={condition}>
                  {condition.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <textarea
              name="notes"
              placeholder="Describe what you observed"
              className="w-full rounded border px-3 py-2"
            />

            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium"
            >
              Record observation
            </button>
          </form>
        </div>

        <div className="rounded border p-5">
          <h2 className="text-xl font-semibold">Labor / activity</h2>

          {activeActivity ? (
            <div className="mt-5">
              <div className="rounded border p-4 text-sm">
                <div className="font-medium">
                  {activeActivity.activityType.replaceAll("_", " ")}
                </div>
                <div className="mt-1 opacity-70">
                  Worker: {activeActivity.workerLabel ?? "—"}
                </div>
                <div className="mt-1 opacity-70">
                  Started: {activeActivity.startedAt.toLocaleString()}
                </div>
                {activeActivity.notes && (
                  <div className="mt-2">{activeActivity.notes}</div>
                )}
              </div>

              <form
                action={stopWorkActivity.bind(null, activeActivity.id)}
                className="mt-4"
              >
                <button
                  type="submit"
                  className="rounded border px-4 py-2 font-medium"
                >
                  Stop activity and record time
                </button>
              </form>
            </div>
          ) : (
            <form
              action={startWorkActivity.bind(null, workOrder.id)}
              className="mt-5 space-y-3"
            >
              <input
                name="workerLabel"
                required
                placeholder="Worker name"
                className="w-full rounded border px-3 py-2"
              />

              <select
                name="activityType"
                required
                defaultValue="INSPECTION"
                className="w-full rounded border px-3 py-2"
              >
                {activityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>

              <textarea
                name="notes"
                placeholder="Activity notes"
                className="w-full rounded border px-3 py-2"
              />

              <div className="flex flex-wrap gap-4 text-sm">
                <label>
                  <input name="billable" type="checkbox" className="mr-2" />
                  Billable
                </label>
                <label>
                  <input name="training" type="checkbox" className="mr-2" />
                  Training
                </label>
                <label>
                  <input name="supervised" type="checkbox" className="mr-2" />
                  Supervised
                </label>
              </div>

              <button
                type="submit"
                className="rounded border px-4 py-2 font-medium"
              >
                Start activity
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="mt-8 rounded border p-5">
        <h2 className="text-xl font-semibold">Parts</h2>

        <form
          action={addRequiredPart.bind(null, workOrder.id)}
          className="mt-5 grid gap-3 md:grid-cols-2"
        >
          <input
            name="description"
            required
            placeholder="Part description"
            className="rounded border px-3 py-2"
          />
          <input
            name="partNumber"
            placeholder="Part number"
            className="rounded border px-3 py-2"
          />
          <input
            name="manufacturer"
            placeholder="Manufacturer"
            className="rounded border px-3 py-2"
          />
          <input
            name="source"
            placeholder="Source / supplier"
            className="rounded border px-3 py-2"
          />
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue="1"
            className="rounded border px-3 py-2"
          />
          <input
            name="unitCost"
            type="number"
            min="0"
            step="0.01"
            placeholder="Optional unit cost"
            className="rounded border px-3 py-2"
          />
          <button
            type="submit"
            className="rounded border px-4 py-2 font-medium md:col-span-2"
          >
            Add required part
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {workOrder.parts.length === 0 ? (
            <p className="text-sm opacity-70">No parts recorded.</p>
          ) : (
            workOrder.parts.map((part) => (
              <article key={part.id} className="rounded border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-semibold">
                    {part.quantity} x {part.description}
                  </div>
                  <div className="text-sm">{part.status}</div>
                </div>

                <div className="mt-2 text-sm opacity-70">
                  {[part.manufacturer, part.partNumber]
                    .filter(Boolean)
                    .join(" · ") || "No part number"}
                </div>

                <div className="mt-1 text-sm opacity-70">
                  Unit cost: {moneyFromCents(part.unitCostCents)}
                </div>

                {part.status === "REQUIRED" && (
                  <form
                    action={markPartReceived.bind(null, part.id)}
                    className="mt-4 flex flex-wrap gap-2"
                  >
                    <input
                      name="actorLabel"
                      required
                      placeholder="Receiver name"
                      className="rounded border px-3 py-2"
                    />
                    <button
                      type="submit"
                      className="rounded border px-4 py-2 font-medium"
                    >
                      Mark part received
                    </button>
                  </form>
                )}

                {part.status === "RECEIVED" && (
                  <form
                    action={markPartInstalled.bind(null, part.id)}
                    className="mt-4 grid gap-2 md:grid-cols-2"
                  >
                    <input
                      name="actorLabel"
                      required
                      placeholder="Installer name"
                      className="rounded border px-3 py-2"
                    />
                    <input
                      name="notes"
                      placeholder="Installation note"
                      className="rounded border px-3 py-2"
                    />
                    <button
                      type="submit"
                      className="rounded border px-4 py-2 font-medium md:col-span-2"
                    >
                      Mark part installed
                    </button>
                  </form>
                )}
              </article>
            ))
          )}
        </div>

        {["INTAKE", "OPEN", "IN_PROGRESS"].includes(workOrder.status) && (
          <form
            action={setWorkOrderWaitingParts.bind(null, workOrder.id)}
            className="mt-6 grid gap-3 md:grid-cols-2"
          >
            <input
              name="actorLabel"
              required
              placeholder="Operator name"
              className="rounded border px-3 py-2"
            />
            <input
              name="notes"
              placeholder="Why work is waiting for parts"
              className="rounded border px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
            >
              Set work order to waiting for parts
            </button>
          </form>
        )}

        {workOrder.status === "WAITING_PARTS" && (
          <form
            action={resumeRepair.bind(null, workOrder.id)}
            className="mt-6 grid gap-3 md:grid-cols-2"
          >
            <input
              name="actorLabel"
              required
              placeholder="Operator name"
              className="rounded border px-3 py-2"
            />
            <input
              name="notes"
              placeholder="Repair resume note"
              className="rounded border px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
            >
              Resume repair
            </button>
          </form>
        )}
      </section>

      {["INTAKE", "OPEN", "IN_PROGRESS"].includes(workOrder.status) && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Complete repair and send to testing
          </h2>
          <p className="mt-2 text-sm opacity-70">
            This records the repair result separately from QA. Any active
            activity timer must be stopped, and required/outstanding parts must
            be resolved first.
          </p>

          <form
            action={completeRepairForTesting.bind(null, workOrder.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input
              name="actorLabel"
              required
              placeholder="Technician name"
              className="rounded border px-3 py-2"
            />
            <textarea
              name="resolution"
              required
              placeholder="What was repaired, replaced, configured, or otherwise resolved?"
              className="rounded border px-3 py-2 md:row-span-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium"
            >
              Complete repair and begin testing
            </button>
          </form>
        </section>
      )}

      {workOrder.status === "TESTING" && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Quality assurance / functional test
          </h2>
          <p className="mt-2 text-sm opacity-70">
            A passed test marks the asset known-good and READY. A failed test
            returns the work order to IN_PROGRESS and the asset to REPAIR.
          </p>

          <form
            action={recordQaResult.bind(null, workOrder.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input
              name="actorLabel"
              required
              placeholder="Tester name"
              className="rounded border px-3 py-2"
            />
            <select
              name="result"
              required
              defaultValue=""
              className="rounded border px-3 py-2"
            >
              <option value="" disabled>
                Select QA result
              </option>
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
            </select>
            <textarea
              name="notes"
              placeholder="Test method, measurements, failures, exceptions, or release note"
              className="rounded border px-3 py-2 md:col-span-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
            >
              Record QA result
            </button>
          </form>
        </section>
      )}

      {workOrder.status === "READY" && (
        <section id="next-action" className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Prepare return to customer
          </h2>
          <p className="mt-2 text-sm opacity-70">
            Packing is recorded separately from shipping. The asset remains in
            CESCo custody until the outbound carrier actually accepts it.
          </p>

          <form
            action={packReadyAsset.bind(null, workOrder.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input
              name="actorLabel"
              required
              placeholder="Packer name"
              className="rounded border px-3 py-2"
            />
            <input
              name="notes"
              placeholder="Packing note, box/seal condition, included accessories"
              className="rounded border px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
            >
              Mark asset packed
            </button>
          </form>
        </section>
      )}

      {workOrder.status === "PACKED" && !outboundShipment && (
        <section id="next-action" className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Create outbound shipment
          </h2>

          {customerSites.length === 0 ? (
            <p className="mt-4 text-sm opacity-70">
              The asset owner does not yet have a destination site. Add the
              customer destination before creating the return shipment.
            </p>
          ) : (
            <form
              action={createOutboundShipment.bind(null, workOrder.id)}
              className="mt-5 grid gap-3 md:grid-cols-2"
            >
              <input
                name="actorLabel"
                required
                placeholder="Operator name"
                className="rounded border px-3 py-2"
              />
              <select
                name="destinationSiteId"
                required
                defaultValue=""
                className="rounded border px-3 py-2"
              >
                <option value="" disabled>
                  Select customer destination
                </option>
                {customerSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
              <input
                name="carrier"
                required
                placeholder="Carrier"
                className="rounded border px-3 py-2"
              />
              <input
                name="trackingNumber"
                required
                placeholder="Tracking number"
                className="rounded border px-3 py-2"
              />
              <button
                type="submit"
                className="rounded border px-4 py-2 font-medium md:col-span-2"
              >
                Save outbound shipment
              </button>
            </form>
          )}
        </section>
      )}

      {outboundShipment && (
        <section id="next-action" className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Outbound return
          </h2>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <span className="opacity-60">Destination:</span>{" "}
              {outboundShipment.destinationSite.name}
            </div>
            <div>
              <span className="opacity-60">Status:</span>{" "}
              {outboundShipment.status}
            </div>
            <div>
              <span className="opacity-60">Carrier:</span>{" "}
              {outboundShipment.carrier ?? "—"}
            </div>
            <div>
              <span className="opacity-60">Tracking:</span>{" "}
              {outboundShipment.trackingNumber ?? "—"}
            </div>
          </div>

          {outboundShipment.status === "TRACKING_ENTERED" && (
            <form
              action={markOutboundShipmentAccepted.bind(
                null,
                outboundShipment.id
              )}
              className="mt-5 flex flex-wrap gap-3"
            >
              <input
                name="actorLabel"
                required
                placeholder="Operator name"
                className="rounded border px-3 py-2"
              />
              <button
                type="submit"
                className="rounded border px-4 py-2 font-medium"
              >
                Simulate outbound carrier acceptance
              </button>
            </form>
          )}

          {outboundShipment.status === "IN_TRANSIT" && (
            <form
              action={confirmOutboundDelivery.bind(
                null,
                outboundShipment.id
              )}
              className="mt-5 grid gap-3 md:grid-cols-2"
            >
              <input
                name="actorLabel"
                required
                placeholder="Delivery confirmer"
                className="rounded border px-3 py-2"
              />
              <input
                name="notes"
                placeholder="Delivery note / carrier confirmation"
                className="rounded border px-3 py-2"
              />
              <button
                type="submit"
                className="rounded border px-4 py-2 font-medium md:col-span-2"
              >
                Confirm delivery to customer
              </button>
            </form>
          )}

          {outboundShipment.status === "DELIVERED" && (
            <p className="mt-5 text-sm font-medium">
              Delivery confirmed. CESCo custody has ended and the service
              request is complete.
            </p>
          )}
        </section>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">Observations</h2>
          <div className="mt-4 space-y-3">
            {workOrder.observations.length === 0 ? (
              <p className="text-sm opacity-70">
                No condition observations yet.
              </p>
            ) : (
              workOrder.observations.map((observation) => (
                <article
                  key={observation.id}
                  className="rounded border p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-semibold">
                      {observation.condition.replaceAll("_", " ")}
                    </div>
                    <time className="text-sm opacity-60">
                      {observation.observedAt.toLocaleString()}
                    </time>
                  </div>
                  <div className="mt-2 text-sm">
                    {observation.observationType ?? "Observation"}
                  </div>
                  {observation.notes && (
                    <div className="mt-2 text-sm opacity-70">
                      {observation.notes}
                    </div>
                  )}
                  <div className="mt-2 text-xs opacity-50">
                    Observer: {observation.observerLabel ?? "—"}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">Labor history</h2>
          <div className="mt-4 space-y-3">
            {workOrder.activities.length === 0 ? (
              <p className="text-sm opacity-70">
                No labor/activity records yet.
              </p>
            ) : (
              workOrder.activities.map((activity) => (
                <article
                  key={activity.id}
                  className="rounded border p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-semibold">
                      {activity.activityType.replaceAll("_", " ")}
                    </div>
                    <div className="text-sm">
                      {activity.durationMinutes !== null
                        ? `${activity.durationMinutes} min`
                        : "ACTIVE"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm opacity-70">
                    {activity.workerLabel ?? "Unidentified worker"}
                  </div>
                  <div className="mt-1 text-xs opacity-50">
                    {activity.startedAt.toLocaleString()}
                    {activity.endedAt
                      ? ` → ${activity.endedAt.toLocaleString()}`
                      : ""}
                  </div>
                  <div className="mt-2 text-xs opacity-60">
                    {activity.billable ? "Billable" : "Non-billable"}
                    {activity.training ? " · Training" : ""}
                    {activity.supervised ? " · Supervised" : ""}
                  </div>
                  {activity.notes && (
                    <div className="mt-2 text-sm">{activity.notes}</div>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">
          Operational timeline
        </h2>

        <div className="mt-5 space-y-3">
          {workOrder.events.length === 0 ? (
            <p className="text-sm opacity-70">
              No work-order events recorded yet.
            </p>
          ) : (
            workOrder.events.map((event) => (
              <article key={event.id} className="rounded border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-semibold">{event.eventType}</div>
                  <time className="text-sm opacity-60">
                    {event.createdAt.toLocaleString()}
                  </time>
                </div>
                <div className="mt-2 text-sm">
                  {event.fromStatus ?? "—"} →{" "}
                  {event.toStatus ?? "—"}
                </div>
                {event.notes && (
                  <div className="mt-2 text-sm opacity-70">
                    {event.notes}
                  </div>
                )}
                <div className="mt-2 text-xs opacity-50">
                  Actor: {event.actorLabel ?? (event.systemGenerated ? "system" : "—")}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
