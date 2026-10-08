import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelSpareRequisition,
  createSpareRequisition,
  reserveSpareForRequisition,
} from "@/app/actions/spare-requisitions";
import {
  requireOrganizationPagePermission,
  userHasOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SpareRequisitionsPage({
  params,
}: PageProps) {
  const { id: organizationId } = await params;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      kind: true,
    },
  });

  if (!organization || organization.kind !== "CLIENT") {
    notFound();
  }

  const currentUser = await requireOrganizationPagePermission(
    "spare_requisition.view",
    organizationId
  );

  const canCreate = userHasOrganizationPermission(
    currentUser,
    "spare_requisition.create",
    organizationId
  );
  const canManage = userHasOrganizationPermission(
    currentUser,
    "spare_requisition.manage",
    organizationId
  );

  const [endpoints, requisitions] = await Promise.all([
    prisma.endpoint.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: [{ region: "asc" }, { name: "asc" }],
    }),
    prisma.spareRequisition.findMany({
      where: { organizationId },
      include: {
        requestedBy: true,
        assignedBy: true,
        destinationEndpoint: true,
        assignedAsset: {
          include: {
            currentStoragePosition: {
              include: {
                serviceLocation: true,
              },
            },
          },
        },
        sourceStoragePosition: {
          include: {
            serviceLocation: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  const openRequisitions = requisitions.filter(
    (requisition) => requisition.status === "OPEN"
  );

  const candidateAssets = canManage
    ? await prisma.asset.findMany({
        where: {
          organizationId,
          status: { in: ["READY", "STOCKED"] },
          currentStoragePositionId: { not: null },
          currentStoragePosition: {
            is: {
              isActive: true,
              OR: [
                { dedicatedOrganizationId: organizationId },
                {
                  dedicatedOrganizationId: null,
                  serviceLocation: {
                    clientAccess: {
                      some: { organizationId },
                    },
                  },
                },
              ],
            },
          },
          spareAssignments: {
            none: {
              status: "RESERVED",
            },
          },
        },
        include: {
          currentStoragePosition: {
            include: {
              serviceLocation: true,
            },
          },
        },
        orderBy: [
          { manufacturer: "asc" },
          { model: "asc" },
          { assetTag: "asc" },
        ],
      })
    : [];

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link
        href={`/organizations/${organizationId}`}
        className="text-sm underline"
      >
        ← {organization.name}
      </Link>

      <div className="mt-6">
        <p className="text-sm opacity-60">Strategic stocking</p>
        <h1 className="text-3xl font-bold">Spare requisitions</h1>
        <p className="mt-3 max-w-4xl leading-7 opacity-70">
          Request a known-good spare for a customer endpoint without giving
          operational users financial authority. CESCo can reserve inventory
          from an authorized stocking location, then coordinate the carrier,
          courier, field technician, or other hands required to move it.
        </p>
      </div>

      {canCreate && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">Request a spare</h2>
          <form
            action={createSpareRequisition.bind(
              null,
              organizationId
            )}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <select
              name="destinationEndpointId"
              required
              defaultValue=""
              className="rounded border px-3 py-2"
            >
              <option value="" disabled>
                Destination endpoint
              </option>
              {endpoints.map((endpoint) => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.name}
                  {endpoint.externalCode
                    ? ` · ${endpoint.externalCode}`
                    : ""}
                  {endpoint.city || endpoint.state
                    ? ` — ${[endpoint.city, endpoint.state]
                        .filter(Boolean)
                        .join(", ")}`
                    : ""}
                </option>
              ))}
            </select>

            <input
              name="troubleTicketReference"
              placeholder="Trouble ticket / incident reference"
              className="rounded border px-3 py-2"
            />
            <input
              name="manufacturer"
              placeholder="Manufacturer"
              className="rounded border px-3 py-2"
            />
            <input
              name="model"
              placeholder="Model / standardized platform"
              className="rounded border px-3 py-2"
            />
            <input
              name="priority"
              placeholder="Priority / SLA context"
              className="rounded border px-3 py-2"
            />
            <input
              name="compatibilityNotes"
              placeholder="Compatibility / configuration requirement"
              className="rounded border px-3 py-2"
            />
            <textarea
              name="notes"
              placeholder="Operational notes: failure, required handoff, access constraints, return expectation..."
              className="rounded border px-3 py-2 md:col-span-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
              disabled={endpoints.length === 0}
            >
              Create spare requisition
            </button>
          </form>

          {endpoints.length === 0 && (
            <p className="mt-3 text-sm opacity-70">
              Add at least one customer endpoint before requesting a spare.
            </p>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Requisition history</h2>
        <div className="mt-5 space-y-4">
          {requisitions.length === 0 ? (
            <p className="text-sm opacity-70">
              No spare requisitions have been created yet.
            </p>
          ) : (
            requisitions.map((requisition) => (
              <article
                key={requisition.id}
                className="rounded border p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">
                      {[
                        requisition.manufacturer,
                        requisition.model,
                      ]
                        .filter(Boolean)
                        .join(" ") ||
                        requisition.compatibilityNotes ||
                        "Compatible spare"}
                    </div>
                    <div className="mt-1 text-sm opacity-70">
                      To: {requisition.destinationEndpoint.name}
                      {requisition.troubleTicketReference
                        ? ` · Ticket ${requisition.troubleTicketReference}`
                        : ""}
                    </div>
                  </div>
                  <div className="rounded border px-3 py-1 text-sm">
                    {requisition.status}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                  <div>
                    Requested by:{" "}
                    {requisition.requestedBy.displayName ??
                      requisition.requestedBy.email}
                  </div>
                  <div>
                    Requested:{" "}
                    {requisition.requestedAt.toLocaleString()}
                  </div>
                  <div>
                    Priority: {requisition.priority ?? "Not specified"}
                  </div>
                  <div>
                    Compatibility:{" "}
                    {requisition.compatibilityNotes ??
                      "No additional notes"}
                  </div>
                </div>

                {requisition.assignedAsset && (
                  <div className="mt-4 rounded border p-4 text-sm">
                    <div className="font-medium">
                      Reserved asset:{" "}
                      <Link
                        href={`/assets/${requisition.assignedAsset.id}`}
                        className="underline"
                      >
                        {requisition.assignedAsset.assetTag}
                      </Link>
                    </div>
                    <div className="mt-1 opacity-70">
                      {[
                        requisition.assignedAsset.manufacturer,
                        requisition.assignedAsset.model,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </div>
                    <div className="mt-1 opacity-70">
                      Source:{" "}
                      {requisition.sourceStoragePosition
                        ? `${requisition.sourceStoragePosition.serviceLocation.name} / ${requisition.sourceStoragePosition.name}`
                        : "Not recorded"}
                    </div>
                    <div className="mt-1 opacity-70">
                      Reserved by:{" "}
                      {requisition.assignedBy?.displayName ??
                        requisition.assignedBy?.email ??
                        "Not recorded"}
                    </div>
                  </div>
                )}

                {canManage && requisition.status === "OPEN" && (
                  <form
                    action={reserveSpareForRequisition.bind(
                      null,
                      requisition.id
                    )}
                    className="mt-4 grid gap-3 md:grid-cols-2"
                  >
                    <select
                      name="assetId"
                      required
                      defaultValue=""
                      className="rounded border px-3 py-2 md:col-span-2"
                    >
                      <option value="" disabled>
                        Select available known-good / stocked asset
                      </option>
                      {candidateAssets
                        .filter((asset) => {
                          const manufacturerMatches =
                            !requisition.manufacturer ||
                            asset.manufacturer
                              ?.toLowerCase()
                              .includes(
                                requisition.manufacturer.toLowerCase()
                              );
                          const modelMatches =
                            !requisition.model ||
                            asset.model
                              ?.toLowerCase()
                              .includes(
                                requisition.model.toLowerCase()
                              );
                          return manufacturerMatches && modelMatches;
                        })
                        .map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.assetTag} —{" "}
                            {[asset.manufacturer, asset.model]
                              .filter(Boolean)
                              .join(" ") ||
                              "Unspecified hardware"}
                            {" · "}
                            {asset.currentStoragePosition
                              ? `${asset.currentStoragePosition.serviceLocation.name} / ${asset.currentStoragePosition.name}`
                              : "No managed position"}
                          </option>
                        ))}
                    </select>

                    <button
                      type="submit"
                      className="rounded border px-4 py-2 font-medium md:col-span-2"
                    >
                      Reserve selected spare
                    </button>
                  </form>
                )}

                {canCreate &&
                  ["OPEN", "RESERVED"].includes(
                    requisition.status
                  ) && (
                    <form
                      action={cancelSpareRequisition.bind(
                        null,
                        requisition.id
                      )}
                      className="mt-4"
                    >
                      <button
                        type="submit"
                        className="text-sm underline"
                      >
                        Cancel requisition
                      </button>
                    </form>
                  )}
              </article>
            ))
          )}
        </div>
      </section>

      {canManage && openRequisitions.length > 0 && (
        <section className="mt-10 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Operations matching note
          </h2>
          <p className="mt-2 text-sm leading-6 opacity-70">
            Candidate matching in this first slice is based on the requesting
            organization, asset readiness/stock status, managed storage
            placement, and manufacturer/model text. Geography, configuration
            version, compatibility classes, readiness-test age, and SLA routing
            will be layered onto this model next.
          </p>
        </section>
      )}
    </main>
  );
}
