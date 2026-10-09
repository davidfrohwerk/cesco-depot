import Link from "next/link";
import { notFound } from "next/navigation";
import {
  authorizeServiceRequest,
  createInboundShipment,
  markShipmentAccepted,
  receiveInboundPackage,
} from "@/app/actions/service-requests";
import {
  resumeAfterExternalService,
  setWorkOrderWaitingExternalService,
} from "@/app/actions/work-orders";
import {
  acceptExternalServiceShipment,
  confirmExternalServiceShipmentDelivery,
  createExternalServiceShipment,
} from "@/app/actions/external-service";
import {
  uploadAuthorizationEvidence,
  uploadPackageEvidence,
  uploadShipmentEvidence,
} from "@/app/actions/evidence";
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

  const requestScope = await prisma.serviceRequest.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!requestScope) {
    notFound();
  }

  const currentUser = await requireOrganizationPagePermission(
    "organization.view",
    requestScope.organizationId
  );

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      organization: true,
      asset: true,
      authorizations: {
        orderBy: { createdAt: "desc" },
        include: {
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
      },
      shipments: {
        orderBy: { createdAt: "desc" },
        include: {
          destinationSite: true,
          destinationEndpoint: true,
          destinationServiceLocation: true,
          evidence: {
            include: {
              uploader: true,
              _count: {
                select: { accessEvents: true },
              },
            },
            orderBy: { uploadedAt: "desc" },
          },
          packages: {
            include: {
              receipt: {
                include: {
                  storageLocation: true,
                  storagePosition: {
                    include: {
                      serviceLocation: true,
                    },
                  },
                },
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
          },
          workOrders: {
            orderBy: { openedAt: "desc" },
          },
        },
      },
      workOrders: {
        orderBy: { openedAt: "desc" },
      },
      externalServiceCases: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!request) {
    notFound();
  }

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
  const canManageWorkOrder = userHasOrganizationPermission(
    currentUser,
    "work_order.manage",
    request.organizationId
  );
  const canViewEvidence = userHasOrganizationPermission(
    currentUser,
    "evidence.view",
    request.organizationId
  );
  const canUploadEvidence = userHasOrganizationPermission(
    currentUser,
    "evidence.upload",
    request.organizationId
  );

  const [serviceLocations, returnEndpoints] = await Promise.all([
    prisma.serviceLocation.findMany({
    where: {
      isActive: true,
      clientAccess: {
        some: {
          organizationId: request.organizationId,
        },
      },
    },
    orderBy: [{ region: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      state: true,
      region: true,
      climateControlled: true,
      secureStorage: true,
    },
    }),
    prisma.endpoint.findMany({
      where: {
        organizationId: request.organizationId,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        externalCode: true,
        city: true,
        state: true,
      },
    }),
  ]);

  const approvedAuthorization = request.authorizations.find(
    (authorization) => authorization.status === "APPROVED"
  );

  const inboundShipment =
    request.shipments.find(
      (candidate) =>
        candidate.direction === "INBOUND" &&
        !candidate.externalServiceCaseId
    ) ?? null;

  const outboundShipment =
    request.shipments.find(
      (candidate) =>
        candidate.direction === "OUTBOUND" &&
        !candidate.externalServiceCaseId
    ) ?? null;

  const externalServiceCase =
    request.externalServiceCases[0] ?? null;
  const externalOutboundShipment = externalServiceCase
    ? request.shipments.find(
        (candidate) =>
          candidate.externalServiceCaseId ===
            externalServiceCase.id &&
          candidate.externalServiceLeg === "TO_PROVIDER"
      ) ?? null
    : null;
  const externalReturnShipment = externalServiceCase
    ? request.shipments.find(
        (candidate) =>
          candidate.externalServiceCaseId ===
            externalServiceCase.id &&
          candidate.externalServiceLeg === "FROM_PROVIDER"
      ) ?? null
    : null;

  const workOrder = request.workOrders[0] ?? null;
  const pkg = inboundShipment?.packages[0] ?? null;

  const storagePositions =
    canReceiveInventory &&
    inboundShipment?.destinationServiceLocationId
      ? await prisma.storagePosition.findMany({
          where: {
            serviceLocationId:
              inboundShipment.destinationServiceLocationId,
            isActive: true,
            OR: [
              { dedicatedOrganizationId: null },
              {
                dedicatedOrganizationId:
                  request.organizationId,
              },
            ],
          },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        })
      : [];

  const externalReturnStoragePositions =
    canReceiveInventory &&
    externalReturnShipment?.destinationServiceLocationId
      ? await prisma.storagePosition.findMany({
          where: {
            serviceLocationId:
              externalReturnShipment.destinationServiceLocationId,
            isActive: true,
            OR: [
              { dedicatedOrganizationId: null },
              {
                dedicatedOrganizationId:
                  request.organizationId,
              },
            ],
          },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        })
      : [];

  const legacyStorageLocations =
    canReceiveInventory &&
    inboundShipment?.destinationSiteId &&
    !inboundShipment.destinationServiceLocationId
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

      {workOrder &&
        request.serviceType === "OEM_WARRANTY_COORDINATION" && (
          <section className="mt-10 rounded border p-5">
            <h2 className="text-xl font-semibold">
              OEM / external service coordination
            </h2>
            <p className="mt-2 text-sm opacity-70">
              Track the warranty case and both custody/shipping legs without
              treating the OEM as a customer endpoint or CESCo service location.
            </p>

            {!externalServiceCase &&
              canManageWorkOrder &&
              ["INTAKE", "OPEN", "IN_PROGRESS"].includes(
                workOrder.status
              ) && (
                <form
                  action={setWorkOrderWaitingExternalService.bind(
                    null,
                    workOrder.id
                  )}
                  className="mt-5 grid gap-3 md:grid-cols-2"
                >
                  <input
                    name="externalServiceProvider"
                    required
                    defaultValue={
                      request.externalServiceProvider ??
                      request.asset?.warrantyProvider ??
                      ""
                    }
                    placeholder="OEM / authorized service provider"
                    className="rounded border px-3 py-2"
                  />
                  <input
                    name="externalRmaReference"
                    defaultValue={
                      request.externalRmaReference ?? ""
                    }
                    placeholder="RMA / case / entitlement reference"
                    className="rounded border px-3 py-2"
                  />
                  <input
                    name="destinationName"
                    placeholder="OEM repair center / destination name"
                    className="rounded border px-3 py-2 md:col-span-2"
                  />
                  <input
                    name="addressLine1"
                    placeholder="Destination street address"
                    className="rounded border px-3 py-2"
                  />
                  <input
                    name="addressLine2"
                    placeholder="Suite / department / dock"
                    className="rounded border px-3 py-2"
                  />
                  <input
                    name="city"
                    placeholder="City"
                    className="rounded border px-3 py-2"
                  />
                  <input
                    name="state"
                    placeholder="State / province"
                    className="rounded border px-3 py-2"
                  />
                  <input
                    name="postalCode"
                    placeholder="Postal code"
                    className="rounded border px-3 py-2"
                  />
                  <input
                    name="country"
                    defaultValue="US"
                    placeholder="Country"
                    className="rounded border px-3 py-2"
                  />
                  <input
                    name="expectedReturnAt"
                    type="date"
                    className="rounded border px-3 py-2"
                  />
                  <textarea
                    name="notes"
                    placeholder="Coverage decision, provider instructions, shipping prerequisites, or other external-service notes"
                    className="rounded border px-3 py-2 md:col-span-2"
                  />
                  <button
                    type="submit"
                    className="rounded border px-4 py-2 font-medium md:col-span-2"
                  >
                    Open external service case
                  </button>
                </form>
              )}

            {externalServiceCase && (
              <>
                <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <span className="opacity-60">Provider:</span>{" "}
                    {externalServiceCase.providerName}
                  </div>
                  <div>
                    <span className="opacity-60">Case / RMA:</span>{" "}
                    {externalServiceCase.providerCaseReference ??
                      "Not recorded"}
                  </div>
                  <div>
                    <span className="opacity-60">Case status:</span>{" "}
                    {externalServiceCase.status.replaceAll("_", " ")}
                  </div>
                  <div>
                    <span className="opacity-60">Expected return:</span>{" "}
                    {externalServiceCase.expectedReturnAt
                      ? externalServiceCase.expectedReturnAt.toLocaleDateString()
                      : "Not recorded"}
                  </div>
                  <div className="md:col-span-2">
                    <span className="opacity-60">Provider destination:</span>{" "}
                    {[
                      externalServiceCase.destinationName,
                      externalServiceCase.addressLine1,
                      externalServiceCase.addressLine2,
                      externalServiceCase.city,
                      externalServiceCase.state,
                      externalServiceCase.postalCode,
                      externalServiceCase.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Not recorded"}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <article className="rounded border p-4">
                    <h3 className="font-semibold">
                      1. Asset to provider
                    </h3>

                    {!externalOutboundShipment &&
                      canPrepareShipment &&
                      externalServiceCase.status === "PLANNED" && (
                        <form
                          action={createExternalServiceShipment.bind(
                            null,
                            externalServiceCase.id,
                            "TO_PROVIDER"
                          )}
                          className="mt-4 grid gap-3"
                        >
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
                            className="rounded border px-3 py-2 font-medium"
                          >
                            Create provider shipment
                          </button>
                        </form>
                      )}

                    {externalOutboundShipment && (
                      <div className="mt-4 text-sm">
                        <div>
                          {externalOutboundShipment.carrier ?? "Carrier"} ·{" "}
                          {externalOutboundShipment.trackingNumber ??
                            "No tracking"}
                        </div>
                        <div className="mt-1 opacity-70">
                          {externalOutboundShipment.status.replaceAll(
                            "_",
                            " "
                          )}
                        </div>

                        {canManageShipment &&
                          externalOutboundShipment.status ===
                            "TRACKING_ENTERED" && (
                            <form
                              action={acceptExternalServiceShipment.bind(
                                null,
                                externalOutboundShipment.id
                              )}
                              className="mt-3"
                            >
                              <button
                                type="submit"
                                className="rounded border px-3 py-2 font-medium"
                              >
                                Record carrier acceptance
                              </button>
                            </form>
                          )}

                        {canManageShipment &&
                          externalOutboundShipment.status ===
                            "IN_TRANSIT" && (
                            <form
                              action={confirmExternalServiceShipmentDelivery.bind(
                                null,
                                externalOutboundShipment.id
                              )}
                              className="mt-3"
                            >
                              <button
                                type="submit"
                                className="rounded border px-3 py-2 font-medium"
                              >
                                Record provider delivery
                              </button>
                            </form>
                          )}
                      </div>
                    )}
                  </article>

                  <article className="rounded border p-4">
                    <h3 className="font-semibold">
                      2. Asset return from provider
                    </h3>

                    {!externalReturnShipment &&
                      canPrepareShipment &&
                      externalServiceCase.status === "AT_PROVIDER" && (
                        <form
                          action={createExternalServiceShipment.bind(
                            null,
                            externalServiceCase.id,
                            "FROM_PROVIDER"
                          )}
                          className="mt-4 grid gap-3"
                        >
                          <input
                            name="carrier"
                            required
                            placeholder="Return carrier"
                            className="rounded border px-3 py-2"
                          />
                          <input
                            name="trackingNumber"
                            required
                            placeholder="Return tracking number"
                            className="rounded border px-3 py-2"
                          />
                          <select
                            name="returnDestination"
                            required
                            defaultValue=""
                            className="rounded border px-3 py-2"
                          >
                            <option value="" disabled>
                              Return destination
                            </option>
                            <optgroup label="Client / downstream endpoints">
                              {returnEndpoints.map((endpoint) => (
                                <option
                                  key={endpoint.id}
                                  value={`ENDPOINT:${endpoint.id}`}
                                >
                                  {endpoint.name}
                                  {endpoint.externalCode
                                    ? ` · ${endpoint.externalCode}`
                                    : ""}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="CESCo / partner service locations">
                              {serviceLocations.map((location) => (
                                <option
                                  key={location.id}
                                  value={`SERVICE_LOCATION:${location.id}`}
                                >
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
                            </optgroup>
                          </select>
                          <button
                            type="submit"
                            className="rounded border px-3 py-2 font-medium"
                          >
                            Create return shipment
                          </button>
                        </form>
                      )}

                    {externalReturnShipment && (
                      <div className="mt-4 text-sm">
                        <div>
                          {externalReturnShipment.carrier ?? "Carrier"} ·{" "}
                          {externalReturnShipment.trackingNumber ??
                            "No tracking"}
                        </div>
                        <div className="mt-1 opacity-70">
                          {externalReturnShipment.status.replaceAll(
                            "_",
                            " "
                          )}
                        </div>
                        <div className="mt-1 opacity-70">
                          Destination:{" "}
                          {externalReturnShipment.destinationEndpoint?.name ??
                            externalReturnShipment
                              .destinationServiceLocation?.name ??
                            "Not recorded"}
                        </div>

                        {canManageShipment &&
                          externalReturnShipment.status ===
                            "TRACKING_ENTERED" && (
                            <form
                              action={acceptExternalServiceShipment.bind(
                                null,
                                externalReturnShipment.id
                              )}
                              className="mt-3"
                            >
                              <button
                                type="submit"
                                className="rounded border px-3 py-2 font-medium"
                              >
                                Record return carrier acceptance
                              </button>
                            </form>
                          )}

                        {canManageShipment &&
                          externalReturnShipment.status === "IN_TRANSIT" &&
                          externalReturnShipment.destinationEndpointId && (
                            <form
                              action={confirmExternalServiceShipmentDelivery.bind(
                                null,
                                externalReturnShipment.id
                              )}
                              className="mt-3"
                            >
                              <button
                                type="submit"
                                className="rounded border px-3 py-2 font-medium"
                              >
                                Record return delivery to endpoint
                              </button>
                            </form>
                          )}

                        {canReceiveInventory &&
                          externalReturnShipment.status === "IN_TRANSIT" &&
                          externalReturnShipment
                            .destinationServiceLocationId &&
                          externalReturnShipment.packages[0] && (
                            <form
                              action={receiveInboundPackage.bind(
                                null,
                                externalReturnShipment.packages[0].id
                              )}
                              className="mt-4 grid gap-3"
                            >
                              <select
                                name="storagePositionId"
                                required
                                defaultValue=""
                                className="rounded border px-3 py-2"
                              >
                                <option value="" disabled>
                                  Receiving / storage position
                                </option>
                                {externalReturnStoragePositions.map(
                                  (position) => (
                                    <option
                                      key={position.id}
                                      value={position.id}
                                    >
                                      {position.name} ·{" "}
                                      {position.type.replaceAll("_", " ")}
                                    </option>
                                  )
                                )}
                              </select>
                              <select
                                name="condition"
                                defaultValue="UNKNOWN"
                                className="rounded border px-3 py-2"
                              >
                                {receiptConditions.map((condition) => (
                                  <option
                                    key={condition}
                                    value={condition}
                                  >
                                    {condition.replaceAll("_", " ")}
                                  </option>
                                ))}
                              </select>
                              <select
                                name="sealIntact"
                                defaultValue=""
                                className="rounded border px-3 py-2"
                              >
                                <option value="">
                                  Seal condition not recorded
                                </option>
                                <option value="true">Seal intact</option>
                                <option value="false">
                                  Seal broken / not intact
                                </option>
                              </select>
                              <textarea
                                name="notes"
                                placeholder="OEM return condition, replacement/repair details, packaging, or receiving notes"
                                className="rounded border px-3 py-2"
                              />
                              <button
                                type="submit"
                                className="rounded border px-3 py-2 font-medium"
                              >
                                Receive return into service location
                              </button>
                            </form>
                          )}
                      </div>
                    )}
                  </article>
                </div>

                {canManageWorkOrder &&
                  externalServiceCase.status === "RETURNED" &&
                  workOrder.status === "WAITING_EXTERNAL_SERVICE" &&
                  !externalReturnShipment?.destinationEndpointId && (
                    <form
                      action={resumeAfterExternalService.bind(
                        null,
                        workOrder.id
                      )}
                      className="mt-5 grid gap-3 md:grid-cols-2"
                    >
                      <textarea
                        name="notes"
                        placeholder="What returned from the OEM/provider, repair/replacement details, or verification notes"
                        className="rounded border px-3 py-2 md:col-span-2"
                      />
                      <button
                        type="submit"
                        className="rounded border px-4 py-2 font-medium md:col-span-2"
                      >
                        Begin CESCo verification
                      </button>
                    </form>
                  )}
              </>
            )}
          </section>
        )}

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

        {approvedAuthorization && canViewEvidence && (
          <div className="mt-6 border-t pt-5">
            <h3 className="font-semibold">Authorization evidence</h3>

            {canUploadEvidence && (
              <form
                action={uploadAuthorizationEvidence.bind(
                  null,
                  approvedAuthorization.id
                )}
                className="mt-4 grid gap-3 md:grid-cols-2"
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
                  defaultValue="SIGNED_AUTHORIZATION"
                  className="rounded border px-3 py-2"
                >
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
                  placeholder="What this document proves"
                  className="rounded border px-3 py-2 md:col-span-2"
                />
                <button
                  type="submit"
                  className="rounded border px-4 py-2 font-medium md:col-span-2"
                >
                  Upload authorization evidence
                </button>
              </form>
            )}

            <div className="mt-4 space-y-3">
              {approvedAuthorization.evidence.length === 0 ? (
                <p className="text-sm opacity-70">
                  No authorization evidence recorded.
                </p>
              ) : (
                approvedAuthorization.evidence.map((evidence) => (
                  <article key={evidence.id} className="rounded border p-4">
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
          </div>
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
              Destination:{" "}
              {inboundShipment.destinationServiceLocation?.name ??
                inboundShipment.destinationSite?.name ??
                "Not recorded"}
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

            {canViewEvidence && (
              <div className="mt-5 rounded border p-4">
                <div className="font-medium">Inbound shipment evidence</div>

                {canUploadEvidence && (
                  <form
                    action={uploadShipmentEvidence.bind(
                      null,
                      inboundShipment.id
                    )}
                    className="mt-4 grid gap-3 md:grid-cols-2"
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
                      defaultValue="SHIPPING_LABEL"
                      className="rounded border px-3 py-2"
                    >
                      <option value="SHIPPING_LABEL">Shipping label</option>
                      <option value="PACKAGE_EXTERIOR">Package exterior</option>
                      <option value="DAMAGE">Damage</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input
                      name="capturedAt"
                      type="datetime-local"
                      className="rounded border px-3 py-2"
                    />
                    <textarea
                      name="description"
                      placeholder="What this shipment evidence shows"
                      className="rounded border px-3 py-2 md:col-span-2"
                    />
                    <button
                      type="submit"
                      className="rounded border px-4 py-2 font-medium md:col-span-2"
                    >
                      Upload inbound shipment evidence
                    </button>
                  </form>
                )}

                <div className="mt-4 space-y-3">
                  {inboundShipment.evidence.length === 0 ? (
                    <p className="opacity-70">
                      No inbound shipment evidence recorded.
                    </p>
                  ) : (
                    inboundShipment.evidence.map((evidence) => (
                      <article key={evidence.id} className="rounded border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              {evidence.evidenceType.replaceAll("_", " ")}
                            </div>
                            <div className="mt-1 opacity-70">
                              {evidence.originalFilename ?? "Unnamed evidence file"}
                            </div>
                          </div>
                          <a
                            href={`/evidence/${evidence.id}/download`}
                            download
                            className="underline"
                          >
                            Download original
                          </a>
                        </div>
                        <div className="mt-2 text-xs opacity-60">
                          Downloads: {evidence._count.accessEvents}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : canPrepareShipment && serviceLocations.length === 0 ? (
          <div className="mt-4 text-sm">
            <p className="font-medium">
              No CESCo service location is currently assigned to this account.
            </p>
            <p className="mt-2 opacity-70">
              CESCo operations must make an appropriate depot, stocking,
              storage, or partner location available before inbound shipment
              preparation can continue.
            </p>
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
              name="destinationServiceLocationId"
              required
              defaultValue=""
              className="rounded border px-3 py-2 md:col-span-2"
            >
              <option value="" disabled>
                Select CESCo service / stocking destination
              </option>
              {serviceLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {location.city || location.state
                    ? ` — ${[location.city, location.state]
                        .filter(Boolean)
                        .join(", ")}`
                    : ""}
                  {location.climateControlled
                    ? " · climate controlled"
                    : ""}
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
              {pkg.receipt.storagePosition
                ? `${pkg.receipt.storagePosition.serviceLocation.name} / ${pkg.receipt.storagePosition.name}`
                : pkg.receipt.storageLocation?.name ??
                  "Not assigned"}
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
        ) : !canReceiveInventory ? (
          <p className="mt-4 text-sm opacity-70">
            Your role can view receipt status but cannot receive inventory.
          </p>
        ) : inboundShipment.destinationServiceLocationId &&
          storagePositions.length === 0 ? (
          <div className="mt-4 text-sm">
            <p className="font-medium">
              The destination service location has no eligible storage positions yet.
            </p>
            <p className="mt-2 opacity-70">
              Define a receiving, cage, rack, shelf, bin, or other position
              before accepting custody.
            </p>
            <Link
              href={`/service-locations/${inboundShipment.destinationServiceLocationId}`}
              className="mt-4 inline-block underline"
            >
              Manage service-location storage positions
            </Link>
          </div>
        ) : !inboundShipment.destinationServiceLocationId &&
          legacyStorageLocations.length === 0 ? (
          <div className="mt-4 text-sm">
            <p className="font-medium">
              This legacy shipment destination has no receiving location.
            </p>
            {inboundShipment.destinationSiteId && (
              <Link
                href={`/sites/${inboundShipment.destinationSiteId}`}
                className="mt-4 inline-block underline"
              >
                Manage legacy storage locations
              </Link>
            )}
          </div>
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

            {inboundShipment.destinationServiceLocationId ? (
              <select
                name="storagePositionId"
                required
                defaultValue=""
                className="rounded border px-3 py-2"
              >
                <option value="" disabled>
                  Select receiving/storage position
                </option>
                {storagePositions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name} —{" "}
                    {position.type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            ) : (
              <select
                name="storageLocationId"
                required
                defaultValue=""
                className="rounded border px-3 py-2"
              >
                <option value="" disabled>
                  Select legacy receiving location
                </option>
                {legacyStorageLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} —{" "}
                    {location.type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            )}

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

      {pkg && canViewEvidence && (
        <section className="mt-6 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Package evidence
          </h2>
          <p className="mt-2 text-sm opacity-70">
            Record arrival condition, labels, visible damage, and identifying
            details before or after package receipt.
          </p>

          {canUploadEvidence && (
            <form
              action={uploadPackageEvidence.bind(null, pkg.id)}
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
                <option value="PACKAGE_EXTERIOR">
                  Package exterior
                </option>
                <option value="SHIPPING_LABEL">
                  Shipping label
                </option>
                <option value="DAMAGE">Damage</option>
                <option value="SERIAL_ASSET_TAG">
                  Serial / asset tag
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
                Upload package evidence
              </button>
            </form>
          )}

          <div className="mt-6 space-y-3">
            {pkg.evidence.length === 0 ? (
              <p className="text-sm opacity-70">
                No package evidence recorded.
              </p>
            ) : (
              pkg.evidence.map((evidence) => (
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
              {outboundShipment.destinationEndpoint?.name ??
                outboundShipment.destinationSite?.name ??
                "Not recorded"}
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

          {canViewEvidence && (
            <div className="mt-5 border-t pt-5">
              <div className="font-medium">Outbound shipment evidence</div>

              {canUploadEvidence && (
                <form
                  action={uploadShipmentEvidence.bind(
                    null,
                    outboundShipment.id
                  )}
                  className="mt-4 grid gap-3 md:grid-cols-2"
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
                    defaultValue="OUTBOUND_SHIPMENT"
                    className="rounded border px-3 py-2"
                  >
                    <option value="OUTBOUND_SHIPMENT">
                      Outbound shipment
                    </option>
                    <option value="PACKING">Packing</option>
                    <option value="SHIPPING_LABEL">Shipping label</option>
                    <option value="DAMAGE">Damage</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    name="capturedAt"
                    type="datetime-local"
                    className="rounded border px-3 py-2"
                  />
                  <textarea
                    name="description"
                    placeholder="Packing, seal, label, handoff, or exception evidence"
                    className="rounded border px-3 py-2 md:col-span-2"
                  />
                  <button
                    type="submit"
                    className="rounded border px-4 py-2 font-medium md:col-span-2"
                  >
                    Upload outbound shipment evidence
                  </button>
                </form>
              )}

              <div className="mt-4 space-y-3">
                {outboundShipment.evidence.length === 0 ? (
                  <p className="text-sm opacity-70">
                    No outbound shipment evidence recorded.
                  </p>
                ) : (
                  outboundShipment.evidence.map((evidence) => (
                    <article key={evidence.id} className="rounded border p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {evidence.evidenceType.replaceAll("_", " ")}
                          </div>
                          <div className="mt-1 opacity-70">
                            {evidence.originalFilename ?? "Unnamed evidence file"}
                          </div>
                        </div>
                        <a
                          href={`/evidence/${evidence.id}/download`}
                          download
                          className="underline"
                        >
                          Download original
                        </a>
                      </div>
                      <div className="mt-2 text-xs opacity-60">
                        Downloads: {evidence._count.accessEvents}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
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
