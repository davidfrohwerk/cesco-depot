import Link from "next/link";
import { notFound } from "next/navigation";
import { createOrganizationServiceRequest } from "@/app/actions/service-requests";
import {
  requireOrganizationPagePermission,
  userHasOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizationServicePage({
  params,
}: PageProps) {
  const { id: organizationId } = await params;

  const user = await requireOrganizationPagePermission(
    "organization.view",
    organizationId
  );

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      assets: {
        include: {
          currentEndpoint: true,
          currentStoragePosition: {
            include: { serviceLocation: true },
          },
        },
        orderBy: { assetTag: "asc" },
      },
      serviceRequests: {
        include: {
          asset: true,
          workOrders: true,
          shipments: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!organization || organization.kind !== "CLIENT") {
    notFound();
  }

  const canCreate = userHasOrganizationPermission(
    user,
    "service_request.create",
    organizationId
  );

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link
        href={`/organizations/${organizationId}`}
        className="text-sm underline"
      >
        ← {organization.name}
      </Link>

      <div className="mt-6">
        <p className="text-sm opacity-60">Service operations</p>
        <h1 className="text-3xl font-bold">
          Request depot or lifecycle service
        </h1>
        <p className="mt-3 max-w-4xl leading-7 opacity-70">
          Select an asset, describe what is happening, and tell CESCo what
          outcome you need. Depot repair, diagnostics, configuration,
          decommissioning, shipment coordination, and OEM warranty handling can
          all begin from the same customer workflow.
        </p>
      </div>

      {canCreate && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">New service request</h2>

          {organization.assets.length === 0 ? (
            <p className="mt-3 text-sm opacity-70">
              Add or import at least one asset before requesting asset service.
            </p>
          ) : (
            <form
              action={createOrganizationServiceRequest.bind(
                null,
                organizationId
              )}
              className="mt-5 grid gap-3 md:grid-cols-2"
            >
              <select
                name="assetId"
                required
                defaultValue=""
                className="rounded border px-3 py-2 md:col-span-2"
              >
                <option value="" disabled>
                  Select asset
                </option>
                {organization.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetTag}
                    {asset.manufacturer || asset.model
                      ? ` · ${[asset.manufacturer, asset.model]
                          .filter(Boolean)
                          .join(" ")}`
                      : ""}
                    {asset.currentEndpoint
                      ? ` — ${asset.currentEndpoint.name}`
                      : asset.currentStoragePosition
                        ? ` — ${asset.currentStoragePosition.serviceLocation.name} / ${asset.currentStoragePosition.name}`
                        : ""}
                    {asset.warrantyProvider
                      ? ` · Warranty: ${asset.warrantyProvider}`
                      : ""}
                  </option>
                ))}
              </select>

              <select
                name="serviceType"
                required
                defaultValue="DIAGNOSE"
                className="rounded border px-3 py-2"
              >
                <option value="DIAGNOSE">Depot diagnostics</option>
                <option value="REPAIR">Depot repair</option>
                <option value="TEST">Test / verify</option>
                <option value="RECONFIGURE">Reconfigure / reimage</option>
                <option value="OEM_WARRANTY_COORDINATION">
                  OEM warranty coordination
                </option>
                <option value="SHIP_ELSEWHERE">Ship elsewhere</option>
                <option value="DECOMMISSION">Decommission</option>
                <option value="DATA_DESTRUCTION">Data destruction</option>
                <option value="DONATE">Donation processing</option>
                <option value="RECYCLE">Recycle</option>
                <option value="OTHER">Other lifecycle service</option>
              </select>

              <input
                name="requestedOutcome"
                placeholder="Requested outcome"
                className="rounded border px-3 py-2"
              />

              <textarea
                name="customerNotes"
                placeholder="Problem description, symptoms, warranty context, ticket number, handling constraints, or other notes"
                className="rounded border px-3 py-2 md:col-span-2"
              />

              <div className="rounded border p-4 text-sm md:col-span-2">
                If the asset may still be under OEM warranty, choose{" "}
                <strong>OEM warranty coordination</strong>. CESCo can preserve
                evidence, coordinate the OEM/RMA path, and avoid treating
                ordinary depot repair as authorized until warranty coverage and
                service scope are clear.
              </div>

              <button
                type="submit"
                className="rounded border px-4 py-2 font-medium md:col-span-2"
              >
                Create service request
              </button>
            </form>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Recent service requests</h2>
        <div className="mt-5 space-y-3">
          {organization.serviceRequests.length === 0 ? (
            <p className="text-sm opacity-70">No service requests yet.</p>
          ) : (
            organization.serviceRequests.map((request) => (
              <Link
                key={request.id}
                href={`/service-requests/${request.id}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {request.asset?.assetTag ?? "Unassigned asset"} ·{" "}
                      {request.serviceType.replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-sm opacity-70">
                      {request.requestedOutcome ??
                        request.customerNotes ??
                        "No requested outcome recorded"}
                    </div>
                  </div>
                  <div className="rounded border px-3 py-1 text-sm">
                    {request.status.replaceAll("_", " ")}
                  </div>
                </div>

                <div className="mt-3 text-xs opacity-60">
                  Shipments: {request.shipments.length} · Work orders:{" "}
                  {request.workOrders.length}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
