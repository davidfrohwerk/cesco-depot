import Link from "next/link";
import {
  grantServiceLocationClientAccess,
} from "@/app/actions/service-locations";
import {
  requireInternalPagePermission,
  userHasInternalPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

export default async function OperationsPage() {
  const user = await requireInternalPagePermission("organization.view");

  const canManageLocations = userHasInternalPermission(
    user,
    "service_location.manage"
  );

  const [
    openRequests,
    activeWorkOrders,
    shipmentExceptions,
    externalCases,
    serviceLocations,
  ] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: {
        organization: { kind: "CLIENT" },
        status: {
          notIn: ["COMPLETED", "CANCELLED"],
        },
      },
      include: {
        organization: {
          include: {
            serviceLocationAccess: {
              select: { serviceLocationId: true },
            },
          },
        },
        asset: {
          include: {
            currentEndpoint: true,
          },
        },
        authorizations: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        shipments: {
          orderBy: { createdAt: "desc" },
        },
        workOrders: {
          orderBy: { openedAt: "desc" },
        },
        externalServiceCases: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.workOrder.findMany({
      where: {
        organization: { kind: "CLIENT" },
        status: {
          notIn: ["COMPLETED", "CANCELLED"],
        },
      },
      include: {
        organization: true,
        asset: true,
        serviceRequest: true,
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
    prisma.shipment.findMany({
      where: {
        status: "EXCEPTION",
        serviceRequest: {
          organization: { kind: "CLIENT" },
        },
      },
      include: {
        serviceRequest: {
          include: {
            organization: true,
            asset: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
    prisma.externalServiceCase.findMany({
      where: {
        status: {
          notIn: ["RETURNED", "CANCELLED"],
        },
        serviceRequest: {
          organization: { kind: "CLIENT" },
        },
      },
      include: {
        serviceRequest: {
          include: { organization: true },
        },
        asset: true,
        shipments: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
    prisma.serviceLocation.findMany({
      where: { isActive: true },
      orderBy: [{ region: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
      },
    }),
  ]);

  const needsRouting = openRequests.filter(
    (request) =>
      request.authorizations.length > 0 &&
      request.organization.serviceLocationAccess.length === 0 &&
      !request.workOrders.length
  );

  const awaitingCustomerAuthorization = openRequests.filter(
    (request) =>
      request.status === "PENDING_AUTHORIZATION" &&
      request.authorizations.length === 0
  );

  const readyForShipmentSetup = openRequests.filter(
    (request) =>
      request.authorizations.length > 0 &&
      request.organization.serviceLocationAccess.length > 0 &&
      request.shipments.length === 0 &&
      request.serviceType !== "OEM_WARRANTY_COORDINATION"
  );

  const activeRequests = openRequests.filter(
    (request) =>
      !needsRouting.includes(request) &&
      !awaitingCustomerAuthorization.includes(request) &&
      !readyForShipmentSetup.includes(request)
  );

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div>
        <p className="text-sm opacity-60">CESCo internal operations</p>
        <h1 className="text-3xl font-bold">Operations queue</h1>
        <p className="mt-3 max-w-4xl leading-7 opacity-70">
          Client activity lands here as work to be routed, received, executed,
          tracked, or resolved. This is the internal counterpart to the client
          portal.
        </p>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Needs CESCo routing", needsRouting.length],
          ["Awaiting client authorization", awaitingCustomerAuthorization.length],
          ["Ready for shipment setup", readyForShipmentSetup.length],
          ["Active work orders", activeWorkOrders.length],
          ["Shipment exceptions", shipmentExceptions.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded border p-4">
            <div className="text-xs opacity-60">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Needs CESCo action</h2>
        <p className="mt-2 text-sm opacity-70">
          Authorized client requests that cannot progress because no CESCo or
          partner service location is currently available to that client.
        </p>

        <div className="mt-5 space-y-3">
          {needsRouting.length === 0 ? (
            <div className="rounded border p-5 text-sm opacity-70">
              No authorized requests currently need service-location routing.
            </div>
          ) : (
            needsRouting.map((request) => (
              <article key={request.id} className="rounded border p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/service-requests/${request.id}`}
                      className="font-semibold underline"
                    >
                      {request.organization.name} ·{" "}
                      {request.asset?.assetTag ?? "Asset"} ·{" "}
                      {request.serviceType.replaceAll("_", " ")}
                    </Link>
                    <div className="mt-2 text-sm opacity-70">
                      {request.requestedOutcome ??
                        request.customerNotes ??
                        "No requested outcome recorded"}
                    </div>
                    <div className="mt-2 text-xs opacity-60">
                      Request status: {request.status.replaceAll("_", " ")}
                      {request.asset?.currentEndpoint
                        ? ` · Current endpoint: ${request.asset.currentEndpoint.name}`
                        : ""}
                    </div>
                  </div>
                  <Link
                    href={`/organizations/${request.organizationId}`}
                    className="text-sm underline"
                  >
                    Client record
                  </Link>
                </div>

                {canManageLocations && serviceLocations.length > 0 && (
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      const serviceLocationId = String(
                        formData.get("serviceLocationId") ?? ""
                      ).trim();
                      if (!serviceLocationId) {
                        throw new Error("Service location is required.");
                      }
                      await grantServiceLocationClientAccess(
                        serviceLocationId,
                        formData
                      );
                    }}
                    className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                  >
                    <input
                      type="hidden"
                      name="organizationId"
                      value={request.organizationId}
                    />
                    <select
                      name="serviceLocationId"
                      required
                      defaultValue=""
                      className="rounded border px-3 py-2"
                    >
                      <option value="" disabled>
                        Assign service location
                      </option>
                      {serviceLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                          {location.city || location.state
                            ? ` — ${[
                                location.city,
                                location.state,
                              ]
                                .filter(Boolean)
                                .join(", ")}`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      name="notes"
                      placeholder="Access / routing note"
                      className="rounded border px-3 py-2"
                    />
                    <button
                      type="submit"
                      className="rounded border px-4 py-2 font-medium"
                    >
                      Assign
                    </button>
                  </form>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">
            Ready for shipment setup
          </h2>
          <div className="mt-5 space-y-3">
            {readyForShipmentSetup.length === 0 ? (
              <p className="text-sm opacity-70">Nothing waiting.</p>
            ) : (
              readyForShipmentSetup.map((request) => (
                <Link
                  key={request.id}
                  href={`/service-requests/${request.id}`}
                  className="block rounded border p-4 hover:bg-black/5"
                >
                  <div className="font-semibold">
                    {request.organization.name} ·{" "}
                    {request.asset?.assetTag ?? "Asset"}
                  </div>
                  <div className="mt-1 text-sm opacity-70">
                    {request.serviceType.replaceAll("_", " ")}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">
            Awaiting client authorization
          </h2>
          <div className="mt-5 space-y-3">
            {awaitingCustomerAuthorization.length === 0 ? (
              <p className="text-sm opacity-70">Nothing waiting.</p>
            ) : (
              awaitingCustomerAuthorization.map((request) => (
                <Link
                  key={request.id}
                  href={`/service-requests/${request.id}`}
                  className="block rounded border p-4 hover:bg-black/5"
                >
                  <div className="font-semibold">
                    {request.organization.name} ·{" "}
                    {request.asset?.assetTag ?? "Asset"}
                  </div>
                  <div className="mt-1 text-sm opacity-70">
                    {request.serviceType.replaceAll("_", " ")}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Active work orders</h2>
        <div className="mt-5 space-y-3">
          {activeWorkOrders.length === 0 ? (
            <p className="text-sm opacity-70">No active work orders.</p>
          ) : (
            activeWorkOrders.map((workOrder) => (
              <Link
                key={workOrder.id}
                href={`/work-orders/${workOrder.id}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {workOrder.number} · {workOrder.organization?.name ?? "Client"}
                    </div>
                    <div className="mt-1 text-sm opacity-70">
                      {workOrder.asset.assetTag} ·{" "}
                      {workOrder.serviceType?.replaceAll("_", " ") ??
                        "Lifecycle work"}
                    </div>
                  </div>
                  <span className="rounded border px-3 py-1 text-sm">
                    {workOrder.status.replaceAll("_", " ")}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {externalCases.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">
            External / OEM service cases
          </h2>
          <div className="mt-5 space-y-3">
            {externalCases.map((externalCase) => (
              <Link
                key={externalCase.id}
                href={`/service-requests/${externalCase.serviceRequestId}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {externalCase.serviceRequest.organization.name} ·{" "}
                      {externalCase.asset.assetTag}
                    </div>
                    <div className="mt-1 text-sm opacity-70">
                      {externalCase.providerName}
                      {externalCase.providerCaseReference
                        ? ` · ${externalCase.providerCaseReference}`
                        : ""}
                    </div>
                  </div>
                  <span className="rounded border px-3 py-1 text-sm">
                    {externalCase.status.replaceAll("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {shipmentExceptions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Shipment exceptions</h2>
          <div className="mt-5 space-y-3">
            {shipmentExceptions.map((shipment) => (
              <Link
                key={shipment.id}
                href={`/service-requests/${shipment.serviceRequestId}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="font-semibold">
                  {shipment.serviceRequest.organization.name} ·{" "}
                  {shipment.serviceRequest.asset?.assetTag ?? "Asset"}
                </div>
                <div className="mt-1 text-sm opacity-70">
                  {shipment.carrier ?? "Carrier"} ·{" "}
                  {shipment.trackingNumber ?? "No tracking"}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {activeRequests.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Other active requests</h2>
          <div className="mt-5 space-y-3">
            {activeRequests.slice(0, 25).map((request) => (
              <Link
                key={request.id}
                href={`/service-requests/${request.id}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="font-semibold">
                  {request.organization.name} ·{" "}
                  {request.asset?.assetTag ?? "Asset"} ·{" "}
                  {request.serviceType.replaceAll("_", " ")}
                </div>
                <div className="mt-1 text-sm opacity-70">
                  {request.status.replaceAll("_", " ")}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
