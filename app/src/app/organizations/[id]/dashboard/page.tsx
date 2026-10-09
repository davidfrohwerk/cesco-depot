import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireOrganizationPagePermission,
  userHasOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <div className="rounded border p-4">
      <div className="text-xs opacity-60">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function CustomerDashboard({
  params,
}: PageProps) {
  const { id: organizationId } = await params;

  const user = await requireOrganizationPagePermission(
    "organization.view",
    organizationId
  );

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      kind: true,
      _count: {
        select: {
          endpoints: true,
          assets: true,
        },
      },
    },
  });

  if (!organization || organization.kind !== "CLIENT") {
    notFound();
  }

  const now = new Date();
  const inThirtyDays = new Date(now);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);

  const [
    openServiceRequests,
    pendingAuthorization,
    inTransitShipments,
    activeWorkOrders,
    shipmentExceptions,
    overdueReadiness,
    warrantyExpiringSoon,
    recentRequests,
  ] = await Promise.all([
    prisma.serviceRequest.count({
      where: {
        organizationId,
        status: {
          notIn: ["COMPLETED", "CANCELLED"],
        },
      },
    }),
    prisma.serviceRequest.count({
      where: {
        organizationId,
        status: "PENDING_AUTHORIZATION",
      },
    }),
    prisma.shipment.count({
      where: {
        serviceRequest: { organizationId },
        status: "IN_TRANSIT",
      },
    }),
    prisma.workOrder.count({
      where: {
        organizationId,
        status: {
          notIn: ["COMPLETED", "CANCELLED"],
        },
      },
    }),
    prisma.shipment.count({
      where: {
        serviceRequest: { organizationId },
        status: "EXCEPTION",
      },
    }),
    prisma.asset.count({
      where: {
        organizationId,
        nextReadinessDueAt: { lt: now },
        status: { in: ["READY", "STOCKED"] },
      },
    }),
    prisma.asset.count({
      where: {
        organizationId,
        warrantyExpiresAt: {
          gte: now,
          lte: inThirtyDays,
        },
      },
    }),
    prisma.serviceRequest.findMany({
      where: { organizationId },
      include: {
        asset: true,
        shipments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        workOrders: {
          orderBy: { openedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const canRequestService = userHasOrganizationPermission(
    user,
    "service_request.create",
    organizationId
  );
  const canViewSpares = userHasOrganizationPermission(
    user,
    "spare_requisition.view",
    organizationId
  );

  const attentionItems = [
    {
      label: "Service requests awaiting authorization",
      count: pendingAuthorization,
      href: `/organizations/${organizationId}/service`,
    },
    {
      label: "Shipment exceptions",
      count: shipmentExceptions,
      href: `/organizations/${organizationId}/service`,
    },
    {
      label: "Strategic spares overdue for readiness verification",
      count: overdueReadiness,
      href: `/organizations/${organizationId}/spares`,
    },
    {
      label: "Asset warranties expiring in the next 30 days",
      count: warrantyExpiringSoon,
      href: `/organizations/${organizationId}#assets`,
    },
  ].filter((item) => item.count > 0);

  return (
    <main className="mx-auto max-w-7xl p-8">
      <Link
        href={`/organizations/${organizationId}`}
        className="text-sm underline"
      >
        ← {organization.name}
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm opacity-60">Customer home</p>
          <h1 className="text-3xl font-bold">{organization.name}</h1>
          <p className="mt-3 max-w-3xl leading-7 opacity-70">
            See what is happening across your assets, service activity,
            shipments, readiness, and lifecycle work without moving between
            separate provider portals.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          {canRequestService && (
            <Link
              href={`/organizations/${organizationId}/service`}
              className="rounded border px-4 py-2 font-medium"
            >
              Request depot service
            </Link>
          )}
          {canViewSpares && (
            <Link
              href={`/organizations/${organizationId}/spares`}
              className="rounded border px-4 py-2 font-medium"
            >
              Request replacement
            </Link>
          )}
        </div>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Locations" value={organization._count.endpoints} />
        <Metric label="Assets" value={organization._count.assets} />
        <Metric
          label="Open service requests"
          value={openServiceRequests}
          href={`/organizations/${organizationId}/service`}
        />
        <Metric label="Active work orders" value={activeWorkOrders} />
        <Metric label="Shipments in transit" value={inTransitShipments} />
        <Metric label="Awaiting authorization" value={pendingAuthorization} />
        <Metric label="Shipment exceptions" value={shipmentExceptions} />
        <Metric label="Readiness overdue" value={overdueReadiness} />
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Needs attention</h2>
        <div className="mt-5 space-y-3">
          {attentionItems.length === 0 ? (
            <div className="rounded border p-5 text-sm opacity-70">
              No current exceptions, overdue readiness checks, or pending
              authorization items were found.
            </div>
          ) : (
            attentionItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded border p-4 hover:bg-black/5"
              >
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Recent service activity</h2>
          <Link
            href={`/organizations/${organizationId}/service`}
            className="text-sm underline"
          >
            View service workspace
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {recentRequests.length === 0 ? (
            <p className="text-sm opacity-70">No service activity yet.</p>
          ) : (
            recentRequests.map((request) => (
              <Link
                key={request.id}
                href={`/service-requests/${request.id}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {request.asset?.assetTag ?? "Asset"} ·{" "}
                      {request.serviceType.replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-sm opacity-70">
                      {request.requestedOutcome ??
                        request.customerNotes ??
                        "No description recorded"}
                    </div>
                  </div>
                  <div className="rounded border px-3 py-1 text-sm">
                    {request.status.replaceAll("_", " ")}
                  </div>
                </div>

                <div className="mt-3 text-xs opacity-60">
                  Shipment:{" "}
                  {request.shipments[0]?.status.replaceAll("_", " ") ??
                    "not created"}{" "}
                  · Work order:{" "}
                  {request.workOrders[0]?.status.replaceAll("_", " ") ??
                    "not open"}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
