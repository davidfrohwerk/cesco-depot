import Link from "next/link";
import { notFound } from "next/navigation";
import {
  authorizeServiceRequest,
  createInboundShipment,
  markShipmentAccepted,
  receiveInboundPackage,
} from "@/app/actions/service-requests";
import {
  requireOrganizationPermission,
  userHasOrganizationPermission,
} from "@/lib/access-scope";
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

const receiptConditions = [
  "UNKNOWN",
  "GOOD",
  "DAMAGED",
  "TAMPERED",
  "WET",
  "CRUSHED",
  "OPEN",
  "OTHER",
] as const;

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
          packages: {
            include: {
              receipt: {
                include: {
                  storageLocation: true,
                },
              },
            },
          },
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

  const currentUser = await requireOrganizationPermission(
    "organization.view",
    request.organizationId
  );

  const canAuthorize = userHasOrganizationPermission(
    currentUser,
    "service_request.authorize",
    request.organizationId
  );
  const canPrepareShipment = userHasOrganizationPermission(
    currentUser,
    "shipment.prepare",
    request.organizationId
  );
  const canManageShipment = userHasOrganizationPermission(
    currentUser,
    "shipment.manage",
    request.organizationId
  );
  const canReceiveInventory = userHasOrganizationPermission(
    currentUser,
    "inventory.receive",
    request.organizationId
  );

  const sites = await prisma.site.findMany({
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
    include: {
      organization: true,
    },
  });

  const approvedAuthorization = request.authorizations.find(
    (authorization) => authorization.status === "APPROVED"
  );

  const inboundShipment =
    request.shipments.find(
      (candidate) => candidate.direction === "INBOUND"
    ) ?? null;

  const outboundShipment =
    request.shipments.find(
      (candidate) => candidate.direction === "OUTBOUND"
    ) ?? null;

  const workOrder = request.workOrders[0] ?? null;
  const pkg = inboundShipment?.packages[0] ?? null;

  const storageLocations = inboundShipment
    ? await prisma.storageLocation.findMany({
        where: {
          siteId: inboundShipment.destinationSiteId,
          isActive: true,
        },
        orderBy: { name: "asc" },
      })
    : [];

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
          <p className="text-sm opacity-60">Service request</p>
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
              <Link
                href={`/work-orders/${workOrder.id}`}
                className="font-medium underline"
              >
                {workOrder.number}
              </Link>
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
        ) : canAuthorize ? (
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
        ) : (
          <p className="mt-4 text-sm opacity-70">
            You can view this request, but your role cannot authorize service.
          </p>
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
        ) : inboundShipment ? (
          <div className="mt-4 text-sm">
            <div className="font-medium">
              {inboundShipment.carrier ?? "Carrier"} ·{" "}
              {inboundShipment.trackingNumber ?? "No tracking"}
            </div>
            <div className="mt-1">
              Shipment status: {inboundShipment.status}
            </div>
            <div className="mt-1">
              Destination: {inboundShipment.destinationSite.name}
            </div>

            {inboundShipment.status === "TRACKING_ENTERED" && (
              <div className="mt-5 rounded border p-4">
                <p className="font-medium">
                  Tracking exists, but operational work has not started.
                </p>
                <p className="mt-2 opacity-70">
                  For this development slice, the button below simulates the
                  carrier acceptance event. A carrier integration/webhook can
                  replace this manual trigger later.
                </p>

                {canManageShipment ? (
                  <form
                    action={markShipmentAccepted.bind(
                      null,
                      inboundShipment.id
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
                ) : (
                  <p className="mt-4 opacity-70">
                    Your role cannot update shipment custody.
                  </p>
                )}
              </div>
            )}

            {(inboundShipment.status === "IN_TRANSIT" ||
              inboundShipment.status === "PARTIALLY_RECEIVED") && (
              <div className="mt-5 rounded border p-4">
                <div className="font-medium">
                  Carrier acceptance confirmed
                </div>
                <div className="mt-2 opacity-70">
                  Accepted:{" "}
                  {inboundShipment.acceptedAt?.toLocaleString() ?? "—"}
                </div>
                <div className="mt-2 opacity-70">
                  Work order is active and the shipment is awaiting receipt.
                </div>
              </div>
            )}

            {inboundShipment.status === "RECEIVED" && (
              <div className="mt-5 rounded border p-4">
                <div className="font-medium">
                  Shipment received by CESCo
                </div>
                <div className="mt-2 opacity-70">
                  Delivered:{" "}
                  {inboundShipment.deliveredAt?.toLocaleString() ?? "—"}
                </div>
              </div>
            )}
          </div>
        ) : canPrepareShipment ? (
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
        ) : (
          <p className="mt-4 text-sm opacity-70">
            Your role cannot prepare shipment records.
          </p>
        )}
      </section>

      <section className="mt-6 rounded border p-5">
        <h2 className="text-xl font-semibold">
          3. Package receipt and inventory intake
        </h2>

        {!inboundShipment || !pkg ? (
          <p className="mt-4 text-sm opacity-70">
            Create the inbound shipment first.
          </p>
        ) : pkg.receipt ? (
          <div className="mt-4 text-sm">
            <div className="font-medium">Package received</div>
            <div className="mt-2">
              Condition: {pkg.receipt.condition}
            </div>
            <div className="mt-1">
              Received: {pkg.receipt.receivedAt.toLocaleString()}
            </div>
            <div className="mt-1">
              Location:{" "}
              {pkg.receipt.storageLocation?.name ?? "Not assigned"}
            </div>
            <div className="mt-1">
              Seal intact:{" "}
              {pkg.receipt.sealIntact === null
                ? "Not recorded"
                : pkg.receipt.sealIntact
                  ? "Yes"
                  : "No"}
            </div>
            {pkg.receipt.notes && (
              <div className="mt-2 opacity-70">
                {pkg.receipt.notes}
              </div>
            )}
          </div>
        ) : inboundShipment.status !== "IN_TRANSIT" &&
          inboundShipment.status !== "PARTIALLY_RECEIVED" ? (
          <p className="mt-4 text-sm opacity-70">
            Package receipt becomes available after carrier acceptance.
          </p>
        ) : storageLocations.length === 0 ? (
          <div className="mt-4 text-sm">
            <p className="font-medium">
              The destination site has no storage locations yet.
            </p>
            <p className="mt-2 opacity-70">
              Define at least one receiving, cage, shelf, bin, or other
              physical location before accepting custody.
            </p>
            <Link
              href={`/sites/${inboundShipment.destinationSiteId}`}
              className="mt-4 inline-block underline"
            >
              Manage {inboundShipment.destinationSite.name} storage locations
            </Link>
          </div>
        ) : !canReceiveInventory ? (
          <p className="mt-4 text-sm opacity-70">
            Your role can view receipt status but cannot receive inventory.
          </p>
        ) : (
          <form
            action={receiveInboundPackage.bind(null, pkg.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <select
              name="condition"
              defaultValue="UNKNOWN"
              className="rounded border px-3 py-2"
            >
              {receiptConditions.map((condition) => (
                <option key={condition} value={condition}>
                  {condition.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <select
              name="storageLocationId"
              required
              defaultValue=""
              className="rounded border px-3 py-2"
            >
              <option value="" disabled>
                Select receiving/storage location
              </option>
              {storageLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} —{" "}
                  {location.type.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <select
              name="sealIntact"
              defaultValue=""
              className="rounded border px-3 py-2"
            >
              <option value="">Seal condition not recorded</option>
              <option value="true">Seal intact</option>
              <option value="false">Seal broken / not intact</option>
            </select>

            <textarea
              name="notes"
              placeholder="Receiving condition, exceptions, visible damage, or other intake notes"
              className="rounded border px-3 py-2 md:row-span-2"
            />

            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium"
            >
              Receive package into CESCo custody
            </button>
          </form>
        )}
      </section>

      {outboundShipment && (
        <section className="mt-6 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Outbound return
          </h2>
          <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
            <div>
              <span className="opacity-60">Status:</span>{" "}
              {outboundShipment.status}
            </div>
            <div>
              <span className="opacity-60">Destination:</span>{" "}
              {outboundShipment.destinationSite.name}
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
        </section>
      )}

      <section className="mt-6 rounded border p-5">
        <h2 className="text-xl font-semibold">
          4. Operational state
        </h2>

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <div className="rounded border p-3">
            <div className="font-medium">Request</div>
            <div className="mt-1 opacity-70">
              {request.status}
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="font-medium">Shipment</div>
            <div className="mt-1 opacity-70">
              {inboundShipment?.status ?? "NOT CREATED"}
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="font-medium">Package</div>
            <div className="mt-1 opacity-70">
              {pkg?.status ?? "NOT CREATED"}
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
