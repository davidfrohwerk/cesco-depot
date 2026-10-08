import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRequest } from "@/app/actions/service-requests";
import { uploadAssetEvidence } from "@/app/actions/evidence";
import { moveAssetToEndpoint } from "@/app/actions/asset-movements";
import {
  acceptDispatchCustody,
  completeDispatch,
  createReverseDispatch,
} from "@/app/actions/dispatch-assignments";
import { updateAssetReadiness } from "@/app/actions/asset-readiness";
import {
  requireOrganizationPagePermission,
  userHasOrganizationPermission,
} from "@/lib/access-scope";
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

  const assetScope = await prisma.asset.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!assetScope) {
    notFound();
  }

  const currentUser = await requireOrganizationPagePermission(
    "asset.view",
    assetScope.organizationId
  );

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      organization: true,
      ownerOrganization: true,
      site: true,
      currentStorageLocation: true,
      currentEndpoint: true,
      currentStoragePosition: {
        include: {
          serviceLocation: true,
        },
      },
      movements: {
        include: {
          actor: true,
          fromEndpoint: true,
          toEndpoint: true,
          fromStoragePosition: {
            include: { serviceLocation: true },
          },
          toStoragePosition: {
            include: { serviceLocation: true },
          },
        },
        orderBy: { occurredAt: "desc" },
      },
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
      dispatchAssignments: {
        include: {
          originEndpoint: true,
          originStoragePosition: {
            include: { serviceLocation: true },
          },
          destinationEndpoint: true,
          destinationStoragePosition: {
            include: { serviceLocation: true },
          },
        },
        orderBy: { assignedAt: "desc" },
      },
      evidence: {
        include: {
          uploader: true,
          _count: {
            select: { accessEvents: true },
          },
        },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!asset) {
    notFound();
  }

  const canManageAsset = userHasOrganizationPermission(
    currentUser,
    "asset.manage",
    asset.organizationId
  );
  const canMoveAsset = userHasOrganizationPermission(
    currentUser,
    "asset.move",
    asset.organizationId
  );
  const endpoints = canMoveAsset
    ? await prisma.endpoint.findMany({
        where: {
          organizationId: asset.organizationId,
          isActive: true,
        },
        orderBy: { name: "asc" },
      })
    : [];

  const canManageDispatch = userHasOrganizationPermission(
    currentUser,
    "dispatch.manage",
    asset.organizationId
  );

  const reverseStoragePositions =
    canManageDispatch && asset.currentEndpointId
      ? await prisma.storagePosition.findMany({
          where: {
            isActive: true,
            OR: [
              {
                dedicatedOrganizationId:
                  asset.organizationId,
              },
              {
                dedicatedOrganizationId: null,
                serviceLocation: {
                  isActive: true,
                  clientAccess: {
                    some: {
                      organizationId:
                        asset.organizationId,
                    },
                  },
                },
              },
            ],
          },
          include: {
            serviceLocation: true,
          },
          orderBy: [
            { serviceLocation: { name: "asc" } },
            { name: "asc" },
          ],
        })
      : [];

  const activeDispatch =
    asset.dispatchAssignments.find((dispatch) =>
      ["ASSIGNED", "IN_TRANSIT"].includes(
        dispatch.status
      )
    ) ?? null;

  const canCreateServiceRequest = userHasOrganizationPermission(
    currentUser,
    "service_request.create",
    asset.organizationId
  );
  const canViewEvidence = userHasOrganizationPermission(
    currentUser,
    "evidence.view",
    asset.organizationId
  );
  const canUploadEvidence = userHasOrganizationPermission(
    currentUser,
    "evidence.upload",
    asset.organizationId
  );

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
                {asset.currentStoragePosition
                  ? `${asset.currentStoragePosition.serviceLocation.name} / ${asset.currentStoragePosition.name}`
                  : asset.currentEndpoint?.name ??
                    asset.currentStorageLocation?.name ??
                    asset.site?.name ??
                    "Not yet recorded"}
              </dd>
            </div>

            <div>
              <dt className="opacity-60">Asset class</dt>
              <dd>{asset.assetClass ?? "—"}</dd>
            </div>
            <div>
              <dt className="opacity-60">Compatibility class</dt>
              <dd>{asset.compatibilityClass ?? "—"}</dd>
            </div>
            <div>
              <dt className="opacity-60">Configuration</dt>
              <dd>{asset.configurationVersion ?? "—"}</dd>
            </div>
            <div>
              <dt className="opacity-60">Last readiness verification</dt>
              <dd>
                {asset.lastReadinessVerifiedAt
                  ? asset.lastReadinessVerifiedAt.toLocaleString()
                  : "Not verified"}
              </dd>
            </div>
            <div>
              <dt className="opacity-60">Next readiness due</dt>
              <dd>
                {asset.nextReadinessDueAt
                  ? asset.nextReadinessDueAt.toLocaleString()
                  : "Not scheduled"}
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

      {canManageAsset && (
        <section className="mt-10 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Strategic spare readiness
          </h2>
          <p className="mt-2 text-sm opacity-70">
            Record the compatibility, approved configuration, and verification
            dates CESCo uses when selecting a known-good spare.
          </p>
          <form
            action={updateAssetReadiness.bind(null, asset.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input
              name="assetClass"
              defaultValue={asset.assetClass ?? ""}
              placeholder="Asset class"
              className="rounded border px-3 py-2"
            />
            <input
              name="compatibilityClass"
              defaultValue={asset.compatibilityClass ?? ""}
              placeholder="Compatibility class"
              className="rounded border px-3 py-2"
            />
            <input
              name="configurationVersion"
              defaultValue={asset.configurationVersion ?? ""}
              placeholder="Configuration / image version"
              className="rounded border px-3 py-2"
            />
            <input
              name="lastReadinessVerifiedAt"
              type="datetime-local"
              className="rounded border px-3 py-2"
            />
            <input
              name="nextReadinessDueAt"
              type="datetime-local"
              className="rounded border px-3 py-2"
            />
            <label className="flex items-center gap-2 text-sm">
              <input name="markReady" type="checkbox" />
              Mark asset READY after this verification
            </label>
            <textarea
              name="readinessNotes"
              defaultValue={asset.readinessNotes ?? ""}
              placeholder="Test results, approved image, accessories, preparation notes..."
              className="rounded border px-3 py-2 md:col-span-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
            >
              Update readiness record
            </button>
          </form>
        </section>
      )}

      {canMoveAsset && endpoints.length > 0 && (
        <section className="mt-10 rounded border p-5">
          <h2 className="text-xl font-semibold">Change endpoint placement</h2>
          <p className="mt-2 text-sm opacity-70">
            Record an asset as deployed or held at another client/downstream
            endpoint. Service-network storage placement is recorded by CESCo
            operations from the service-location workspace.
          </p>
          <form
            action={moveAssetToEndpoint.bind(null, asset.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <select name="endpointId" required defaultValue="" className="rounded border px-3 py-2">
              <option value="" disabled>Select endpoint</option>
              {endpoints.map((endpoint) => (
                <option key={endpoint.id} value={endpoint.id}>{endpoint.name}</option>
              ))}
            </select>
            <input
              name="reason"
              placeholder="Reason / ticket / dispatch reference"
              className="rounded border px-3 py-2"
            />
            <button type="submit" className="rounded border px-4 py-2 font-medium md:col-span-2">
              Record endpoint placement
            </button>
          </form>
        </section>
      )}

      {canManageDispatch &&
        asset.currentEndpoint &&
        !activeDispatch &&
        reverseStoragePositions.length > 0 && (
          <section className="mt-10 rounded border p-5">
            <h2 className="text-xl font-semibold">
              Return / reverse dispatch
            </h2>
            <p className="mt-2 text-sm opacity-70">
              Route this asset from the current client endpoint back into an
              authorized CESCo/partner service location for repair, restock,
              storage, decommissioning, or another controlled next step.
            </p>
            <form
              action={createReverseDispatch.bind(
                null,
                asset.id
              )}
              className="mt-5 grid gap-3 md:grid-cols-2"
            >
              <select
                name="destinationStoragePositionId"
                required
                defaultValue=""
                className="rounded border px-3 py-2 md:col-span-2"
              >
                <option value="" disabled>
                  Select receiving / storage position
                </option>
                {reverseStoragePositions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.serviceLocation.name} / {position.name}
                    {" · "}
                    {position.type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <select
                name="providerCustodyType"
                defaultValue="FIELD_TECHNICIAN"
                className="rounded border px-3 py-2"
              >
                <option value="FIELD_TECHNICIAN">
                  Field technician
                </option>
                <option value="CARRIER">Carrier</option>
                <option value="PARTNER">Partner</option>
                <option value="OTHER">Other</option>
              </select>
              <input
                name="providerLabel"
                required
                placeholder="Provider / technician / courier"
                className="rounded border px-3 py-2"
              />
              <input
                name="externalReference"
                placeholder="Trouble ticket / WorkMarket / courier reference"
                className="rounded border px-3 py-2"
              />
              <input
                name="instructions"
                placeholder="Pickup and receiving instructions"
                className="rounded border px-3 py-2"
              />
              <button
                type="submit"
                className="rounded border px-4 py-2 font-medium md:col-span-2"
              >
                Create reverse dispatch
              </button>
            </form>
          </section>
        )}

      {activeDispatch && (
        <section className="mt-10 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Active dispatch
          </h2>
          <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
            <div>Status: {activeDispatch.status}</div>
            <div>Provider: {activeDispatch.providerLabel}</div>
            <div>
              Origin:{" "}
              {activeDispatch.originEndpoint?.name ??
                (activeDispatch.originStoragePosition
                  ? `${activeDispatch.originStoragePosition.serviceLocation.name} / ${activeDispatch.originStoragePosition.name}`
                  : "Not recorded")}
            </div>
            <div>
              Destination:{" "}
              {activeDispatch.destinationEndpoint?.name ??
                (activeDispatch.destinationStoragePosition
                  ? `${activeDispatch.destinationStoragePosition.serviceLocation.name} / ${activeDispatch.destinationStoragePosition.name}`
                  : "Not recorded")}
            </div>
          </div>

          {canManageDispatch &&
            activeDispatch.status === "ASSIGNED" && (
              <form
                action={acceptDispatchCustody.bind(
                  null,
                  activeDispatch.id
                )}
                className="mt-4"
              >
                <button
                  type="submit"
                  className="rounded border px-4 py-2 font-medium"
                >
                  Record provider custody
                </button>
              </form>
            )}

          {canManageDispatch &&
            activeDispatch.status === "IN_TRANSIT" && (
              <form
                action={completeDispatch.bind(
                  null,
                  activeDispatch.id
                )}
                className="mt-4 grid gap-3 md:grid-cols-2"
              >
                <input
                  name="completionNotes"
                  placeholder="Placement / receiving / handoff note"
                  className="rounded border px-3 py-2"
                />
                <button
                  type="submit"
                  className="rounded border px-4 py-2 font-medium"
                >
                  Complete dispatch
                </button>
              </form>
            )}
        </section>
      )}

      {canCreateServiceRequest && (
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
      )}

      {canViewEvidence && (
        <section className="mt-10 rounded border p-5">
          <h2 className="text-2xl font-semibold">Asset evidence</h2>
          <p className="mt-2 text-sm opacity-70">
            Keep durable evidence with the asset record even when it is not
            tied to a particular service request or work order.
          </p>

          {canUploadEvidence && (
            <form
              action={uploadAssetEvidence.bind(null, asset.id)}
              className="mt-5 grid gap-3 md:grid-cols-2"
            >
              <input
                name="file"
                type="file"
                required
                className="rounded border px-3 py-2 md:col-span-2"
              />

              <select
                name="evidenceType"
                required
                defaultValue=""
                className="rounded border px-3 py-2"
              >
                <option value="" disabled>
                  Select evidence type
                </option>
                <option value="SERIAL_ASSET_TAG">
                  Serial / asset tag
                </option>
                <option value="DAMAGE">Damage</option>
                <option value="TITLE_TRANSFER">
                  Title transfer
                </option>
                <option value="DATA_DESTRUCTION_CERTIFICATE">
                  Data destruction certificate
                </option>
                <option value="SIGNED_AUTHORIZATION">
                  Signed authorization
                </option>
                <option value="OTHER">Other</option>
              </select>

              <input
                name="capturedAt"
                type="datetime-local"
                className="rounded border px-3 py-2"
              />

              <textarea
                name="description"
                placeholder="What this file shows or proves"
                className="rounded border px-3 py-2 md:col-span-2"
              />

              <button
                type="submit"
                className="rounded border px-4 py-2 font-medium md:col-span-2"
              >
                Upload asset evidence
              </button>
            </form>
          )}

          <div className="mt-6 space-y-3">
            {asset.evidence.length === 0 ? (
              <p className="text-sm opacity-70">
                No asset-level evidence recorded.
              </p>
            ) : (
              asset.evidence.map((evidence) => (
                <article
                  key={evidence.id}
                  className="rounded border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {evidence.evidenceType.replaceAll("_", " ")}
                      </div>
                      <div className="mt-1 text-sm opacity-70">
                        {evidence.originalFilename ?? "Unnamed evidence file"}
                      </div>
                    </div>

                    <a
                      href={`/evidence/${evidence.id}/download`}
                      download
                      className="text-sm underline"
                    >
                      Download original
                    </a>
                  </div>

                  {evidence.description && (
                    <div className="mt-3 text-sm">
                      {evidence.description}
                    </div>
                  )}

                  <div className="mt-3 grid gap-1 text-xs opacity-60 md:grid-cols-2">
                    <div>
                      Uploaded: {evidence.uploadedAt.toLocaleString()}
                    </div>
                    <div>
                      By:{" "}
                      {evidence.uploader?.displayName ??
                        evidence.uploader?.email ??
                        "Unknown uploader"}
                    </div>
                    <div>
                      Captured:{" "}
                      {evidence.capturedAt?.toLocaleString() ??
                        "Not recorded"}
                    </div>
                    <div>
                      Downloads: {evidence._count.accessEvents}
                    </div>
                    <div className="md:col-span-2 break-all">
                      SHA-256: {evidence.sha256 ?? "Not recorded"}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

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
        <h2 className="text-2xl font-semibold">Placement & custody history</h2>
        <div className="mt-5 space-y-3">
          {asset.movements.length === 0 ? (
            <p className="text-sm opacity-70">
              No explicit placement movements recorded yet.
            </p>
          ) : (
            asset.movements.map((movement) => (
              <article key={movement.id} className="rounded border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-semibold">
                    {movement.toStoragePosition
                      ? `${movement.toStoragePosition.serviceLocation.name} / ${movement.toStoragePosition.name}`
                      : movement.toEndpoint?.name ?? "Transit / unassigned"}
                  </div>
                  <time className="text-sm opacity-60">
                    {movement.occurredAt.toLocaleString()}
                  </time>
                </div>
                <div className="mt-2 text-sm opacity-70">
                  Custody: {movement.fromCustodyType ?? "—"} →{" "}
                  {movement.toCustodyType ?? "—"}
                </div>
                {movement.reason && (
                  <div className="mt-2 text-sm">{movement.reason}</div>
                )}
                <div className="mt-2 text-xs opacity-50">
                  Actor:{" "}
                  {movement.actor?.displayName ??
                    movement.actor?.email ??
                    "Unknown"}
                </div>
              </article>
            ))
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
