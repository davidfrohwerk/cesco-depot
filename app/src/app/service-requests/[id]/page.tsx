import Link from "next/link";
import { notFound } from "next/navigation";
import {
  authorizeServiceRequest,
  createInboundShipment,
  markShipmentAccepted,
} from "@/app/actions/service-requests";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function moneyFromCents(value: number | null) {
  if (value === null) return "No ceiling";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

export default async function ServiceRequestPage({
  params,
}: PageProps) {
  const { id } = await params;

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      organization: true,
      asset: true,
      authorizations: {
        orderBy: { createdAt: "desc" },
      },
      shipments: {
        orderBy: { createdAt: "desc" },
        include: {
          destinationSite: true,
          packages: true,
          workOrders: {
            orderBy: { openedAt: "desc" },
          },
        },
      },
      workOrders: {
        orderBy: { openedAt: "desc" },
      },
    },
  });

  if (!request) {
    notFound();
  }

  const sites = await prisma.site.findMany({
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
    include: {
      organization: true,
    },
  });

  const approvedAuthorization = request.authorizations.find(
    (authorization) => authorization.status === "APPROVED"
  );

  const shipment = request.shipments[0] ?? null;
  const workOrder = request.workOrders[0] ?? null;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link
        href={
          request.asset
            ? `/assets/${request.asset.id}`
            : `/organizations/${request.organizationId}`
        }
        className="text-sm underline"
      >
        ← Back
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm opacity-60">
            Service request
          </p>
          <h1 className="text-3xl font-bold">
            {request.serviceType.replaceAll("_", " ")}
          </h1>
          <p className="mt-2 opacity-70">
            {request.asset
              ? `${request.asset.assetTag} · ${request.asset.manufacturer ?? ""} ${request.asset.model ?? ""}`.trim()
              : "No asset linked"}
          </p>
        </div>

        <div className="rounded border px-4 py-2 font-medium">
          {request.status}
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded border p-4">
          <h2 className="font-semibold">Requested outcome</h2>
          <p className="mt-3 text-sm">
            {request.requestedOutcome || "Not specified"}
          </p>
          {request.customerNotes && (
            <p className="mt-3 text-sm opacity-70">
              {request.customerNotes}
            </p>
          )}
        </div>

        <div className="rounded border p-4">
          <h2 className="font-semibold">Operational work order</h2>
          {workOrder ? (
            <div className="mt-3 text-sm">
              <div className="font-medium">{workOrder.number}</div>
              <div className="mt-1 opacity-70">
                Status: {workOrder.status}
              </div>
              <div className="mt-1 opacity-70">
                Opened: {workOrder.openedAt.toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm">
              <p className="font-medium">No work order yet.</p>
              <p className="mt-1 opacity-70">
                A work order opens when the shipment is accepted by the carrier,
                not when the request or tracking number is created.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-10 rounded border p-5">
        <h2 className="text-xl font-semibold">
          1. Customer authorization
        </h2>

        {approvedAuthorization ? (
          <div className="mt-4 text-sm">
            <div className="font-medium">Authorized</div>
            <div className="mt-2">
              Scope: {approvedAuthorization.scope}
            </div>
            <div className="mt-1">
              Spending ceiling:{" "}
              {moneyFromCents(
                approvedAuthorization.spendingLimitCents
              )}
            </div>
            <div className="mt-1 opacity-60">
              {approvedAuthorization.authorizedAt?.toLocaleString()}
            </div>
          </div>
        ) : (
          <form
            action={authorizeServiceRequest.bind(null, request.id)}
            className="mt-5 space-y-3"
          >
            <textarea
              name="scope"
              required
              placeholder="Describe what CESCo is authorized to do"
              className="w-full rounded border px-3 py-2"
            />

            <input
              name="spendingLimit"
              type="number"
              min="0"
              step="0.01"
              placeholder="Optional spending ceiling in dollars"
              className="w-full rounded border px-3 py-2"
            />

            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium"
            >
              Authorize service
            </button>
          </form>
        )}
      </section>

      <section className="mt-6 rounded border p-5">
        <h2 className="text-xl font-semibold">
          2. Inbound shipment
        </h2>

        {!approvedAuthorization ? (
          <p className="mt-4 text-sm opacity-70">
            Authorize the service before creating the inbound shipment.
          </p>
        ) : shipment ? (
          <div className="mt-4 text-sm">
            <div className="font-medium">
              {shipment.carrier ?? "Carrier"} ·{" "}
              {shipment.trackingNumber ?? "No tracking"}
            </div>
            <div className="mt-1">
              Shipment status: {shipment.status}
            </div>
            <div className="mt-1">
              Destination: {shipment.destinationSite.name}
            </div>

            {shipment.status === "TRACKING_ENTERED" && (
              <div className="mt-5 rounded border p-4">
                <p className="font-medium">
                  Tracking exists, but operational work has not started.
                </p>
                <p className="mt-2 opacity-70">
                  For this development slice, the button below simulates the
                  carrier acceptance event. A carrier integration/webhook can
                  replace this manual trigger later.
                </p>

                <form
                  action={markShipmentAccepted.bind(
                    null,
                    shipment.id
                  )}
                  className="mt-4"
                >
                  <button
                    type="submit"
                    className="rounded border px-4 py-2 font-medium"
                  >
                    Simulate carrier acceptance
                  </button>
                </form>
              </div>
            )}

            {shipment.status === "IN_TRANSIT" && (
              <div className="mt-5 rounded border p-4">
                <div className="font-medium">
                  Carrier acceptance confirmed
                </div>
                <div className="mt-2 opacity-70">
                  Accepted:{" "}
                  {shipment.acceptedAt?.toLocaleString() ?? "—"}
                </div>
                <div className="mt-2 opacity-70">
                  The work order should now be open as IN_TRANSIT.
                </div>
              </div>
            )}
          </div>
        ) : (
          <form
            action={createInboundShipment.bind(null, request.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input
              name="carrier"
              required
              placeholder="Carrier (UPS, FedEx, USPS...)"
              className="rounded border px-3 py-2"
            />

            <input
              name="trackingNumber"
              required
              placeholder="Tracking number"
              className="rounded border px-3 py-2"
            />

            <select
              name="destinationSiteId"
              required
              defaultValue=""
              className="rounded border px-3 py-2 md:col-span-2"
            >
              <option value="" disabled>
                Select CESCo service destination
              </option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.organization.name} — {site.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
            >
              Save inbound shipment
            </button>
          </form>
        )}
      </section>

      <section className="mt-6 rounded border p-5">
        <h2 className="text-xl font-semibold">
          3. Operational boundary
        </h2>

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded border p-3">
            <div className="font-medium">Request</div>
            <div className="mt-1 opacity-70">
              {request.status}
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="font-medium">Shipment</div>
            <div className="mt-1 opacity-70">
              {shipment?.status ?? "NOT CREATED"}
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="font-medium">Work order</div>
            <div className="mt-1 opacity-70">
              {workOrder?.status ?? "NOT OPEN"}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
