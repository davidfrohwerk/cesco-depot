import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRequest } from "@/app/actions/service-requests";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const serviceOptions = [
  ["DIAGNOSE", "Diagnose"],
  ["REPAIR", "Repair"],
  ["TEST", "Test"],
  ["RECONFIGURE", "Reconfigure / reimage"],
  ["STRATEGIC_STOCK", "Store as strategic spare"],
  ["REDEPLOY", "Redeploy"],
  ["SHIP_ELSEWHERE", "Ship elsewhere"],
  ["DECOMMISSION", "Decommission"],
  ["DATA_DESTRUCTION", "Data destruction"],
  ["DONATE", "Donate to CESCo"],
  ["RECYCLE", "Recycle / disposition"],
] as const;

export default async function AssetPage({ params }: PageProps) {
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      organization: true,
      ownerOrganization: true,
      site: true,
      currentStorageLocation: true,
      events: {
        orderBy: { createdAt: "desc" },
      },
      serviceRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          shipments: {
            orderBy: { createdAt: "desc" },
          },
          workOrders: {
            orderBy: { openedAt: "desc" },
          },
        },
      },
      workOrders: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!asset) {
    notFound();
  }

  const createRequestForAsset = createServiceRequest.bind(
    null,
    asset.id
  );

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link
        href={`/organizations/${asset.organizationId}`}
        className="text-sm underline"
      >
        ← {asset.organization.name}
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{asset.assetTag}</h1>

          <p className="mt-2 opacity-70">
            {[asset.manufacturer, asset.model]
              .filter(Boolean)
              .join(" ") || "Unspecified hardware"}
          </p>
        </div>

        <div className="rounded border px-4 py-2 font-medium">
          {asset.status}
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded border p-4">
          <h2 className="font-semibold">Asset details</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="opacity-60">Serial number</dt>
              <dd>{asset.serialNumber ?? "—"}</dd>
            </div>

            <div>
              <dt className="opacity-60">Account organization</dt>
              <dd>{asset.organization.name}</dd>
            </div>

            <div>
              <dt className="opacity-60">Legal owner</dt>
              <dd>
                {asset.ownerOrganization?.name ??
                  "Not yet explicitly recorded"}
              </dd>
            </div>

            <div>
              <dt className="opacity-60">Custody</dt>
              <dd>
                {asset.currentCustodyType ?? "Not yet recorded"}
                {asset.currentCustodianLabel
                  ? ` — ${asset.currentCustodianLabel}`
                  : ""}
              </dd>
            </div>

            <div>
              <dt className="opacity-60">Current location</dt>
              <dd>
                {asset.currentStorageLocation?.name ??
                  asset.site?.name ??
                  "Not yet recorded"}
              </dd>
            </div>

            <div>
              <dt className="opacity-60">Description</dt>
              <dd>{asset.description ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded border p-4">
          <h2 className="font-semibold">Operational record</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="opacity-60">Service requests</dt>
              <dd>{asset.serviceRequests.length}</dd>
            </div>
            <div>
              <dt className="opacity-60">Work orders</dt>
              <dd>{asset.workOrders.length}</dd>
            </div>
            <div>
              <dt className="opacity-60">Asset events</dt>
              <dd>{asset.events.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-10 rounded border p-5">
        <h2 className="text-xl font-semibold">
          Request service for this asset
        </h2>

        <p className="mt-2 text-sm opacity-70">
          Creating a service request does not open a work order. The
          operational work order begins when the inbound shipment is accepted
          by the carrier.
        </p>

        <form
          action={createRequestForAsset}
          className="mt-5 grid gap-3 md:grid-cols-2"
        >
          <select
            name="serviceType"
            required
            defaultValue=""
            className="rounded border px-3 py-2"
          >
            <option value="" disabled>
              Select desired outcome
            </option>
            {serviceOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            name="requestedOutcome"
            placeholder="Desired outcome"
            className="rounded border px-3 py-2"
          />

          <textarea
            name="customerNotes"
            placeholder="Describe the issue, request, or handling instructions"
            className="rounded border px-3 py-2 md:col-span-2"
          />

          <button
            type="submit"
            className="rounded border px-4 py-2 font-medium md:col-span-2"
          >
            Create service request
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Service requests</h2>

        <div className="mt-5 space-y-3">
          {asset.serviceRequests.length === 0 ? (
            <p className="text-sm opacity-70">
              No service requests yet.
            </p>
          ) : (
            asset.serviceRequests.map((request) => {
              const shipment = request.shipments[0] ?? null;
              const workOrder = request.workOrders[0] ?? null;

              return (
                <Link
                  key={request.id}
                  href={`/service-requests/${request.id}`}
                  className="block rounded border p-4 hover:bg-black/5"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-semibold">
                      {request.serviceType.replaceAll("_", " ")}
                    </div>
                    <div className="text-sm">{request.status}</div>
                  </div>

                  <div className="mt-2 grid gap-1 text-sm opacity-70 md:grid-cols-2">
                    <div>
                      Shipment: {shipment?.status ?? "NOT CREATED"}
                    </div>
                    <div>
                      Work order:{" "}
                      {workOrder
                        ? `${workOrder.number} · ${workOrder.status}`
                        : "NOT OPEN"}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Asset history</h2>

        <div className="mt-5 space-y-3">
          {asset.events.length === 0 ? (
            <p className="text-sm opacity-70">
              No asset events recorded.
            </p>
          ) : (
            asset.events.map((event) => (
              <article key={event.id} className="rounded border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-semibold">{event.eventType}</div>

                  <time className="text-sm opacity-60">
                    {event.createdAt.toLocaleString()}
                  </time>
                </div>

                <div className="mt-2 text-sm">
                  {event.fromStatus ?? "—"} → {event.toStatus ?? "—"}
                </div>

                {event.notes && (
                  <div className="mt-2 text-sm opacity-70">
                    {event.notes}
                  </div>
                )}

                {event.actor && (
                  <div className="mt-2 text-xs opacity-50">
                    Actor: {event.actor}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
