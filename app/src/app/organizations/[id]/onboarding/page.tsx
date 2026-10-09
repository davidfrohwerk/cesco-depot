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

function StatusBadge({
  complete,
  optional = false,
}: {
  complete: boolean;
  optional?: boolean;
}) {
  return (
    <span className="rounded border px-3 py-1 text-xs font-medium">
      {complete ? "Complete" : optional ? "Optional" : "Not started"}
    </span>
  );
}

export default async function OrganizationOnboardingPage({
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
          memberships: true,
          spareRequisitions: true,
        },
      },
    },
  });

  if (!organization || organization.kind !== "CLIENT") {
    notFound();
  }

  const [
    completedImports,
    activeOrInvitedMemberships,
    stockedOrReadyAssets,
  ] = await Promise.all([
    prisma.importJob.count({
      where: {
        organizationId,
        status: "COMPLETED",
      },
    }),
    prisma.membership.count({
      where: {
        organizationId,
        status: {
          in: ["ACTIVE", "INVITED"],
        },
      },
    }),
    prisma.asset.count({
      where: {
        organizationId,
        status: {
          in: ["READY", "STOCKED"],
        },
      },
    }),
  ]);

  const canImport = userHasOrganizationPermission(
    user,
    "import.view",
    organizationId
  );
  const canManageUsers = userHasOrganizationPermission(
    user,
    "organization.manage_users",
    organizationId
  );
  const canViewSpares = userHasOrganizationPermission(
    user,
    "spare_requisition.view",
    organizationId
  );
  const canRequestService = userHasOrganizationPermission(
    user,
    "service_request.create",
    organizationId
  );

  const locationsComplete = organization._count.endpoints > 0;
  const assetsComplete = organization._count.assets > 0;
  const teamComplete = activeOrInvitedMemberships > 1;
  const coreComplete = locationsComplete && assetsComplete;

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link
        href={`/organizations/${organizationId}`}
        className="text-sm underline"
      >
        ← {organization.name}
      </Link>

      <div className="mt-6">
        <p className="text-sm opacity-60">Guided setup</p>
        <h1 className="text-3xl font-bold">
          Set up {organization.name}
        </h1>
        <p className="mt-3 max-w-3xl leading-7 opacity-70">
          CESCo Depot can start with the data and people you already have.
          Complete the core steps below, then add operational capabilities as
          they become useful. You do not need to understand the underlying
          data model to get started.
        </p>
      </div>

      <section className="mt-8 rounded border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Core setup</h2>
            <p className="mt-1 text-sm opacity-70">
              {coreComplete
                ? "Your organization has locations and assets in CESCo Depot."
                : "Start with locations, then bring in the assets assigned to them."}
            </p>
          </div>
          <span className="rounded border px-3 py-1 text-sm">
            {[locationsComplete, assetsComplete].filter(Boolean).length}/2 complete
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm opacity-60">Step 1</p>
                <h3 className="text-lg font-semibold">Add your locations</h3>
              </div>
              <StatusBadge complete={locationsComplete} />
            </div>
            <p className="mt-3 text-sm leading-6 opacity-70">
              Stores, branches, clinics, offices, warehouses, and other
              supported customer locations.
            </p>
            <div className="mt-4 text-sm">
              Current: <strong>{organization._count.endpoints}</strong> locations
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {canImport && (
                <Link
                  href={`/organizations/${organizationId}/imports`}
                  className="underline"
                >
                  Import locations
                </Link>
              )}
              <Link
                href={`/organizations/${organizationId}#customer-endpoints`}
                className="underline"
              >
                Add one manually
              </Link>
            </div>
          </article>

          <article className="rounded border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm opacity-60">Step 2</p>
                <h3 className="text-lg font-semibold">Add your assets</h3>
              </div>
              <StatusBadge complete={assetsComplete} />
            </div>
            <p className="mt-3 text-sm leading-6 opacity-70">
              Import the equipment you already track and associate it with
              your existing location identifiers.
            </p>
            <div className="mt-4 text-sm">
              Current: <strong>{organization._count.assets}</strong> assets
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {canImport && (
                <Link
                  href={`/organizations/${organizationId}/imports`}
                  className="underline"
                >
                  Import assets
                </Link>
              )}
              <Link
                href={`/organizations/${organizationId}#assets`}
                className="underline"
              >
                Add one manually
              </Link>
            </div>
          </article>
        </div>

        {completedImports > 0 && (
          <p className="mt-5 text-sm opacity-70">
            {completedImports} completed bulk import
            {completedImports === 1 ? "" : "s"} recorded for this organization.
          </p>
        )}

        {coreComplete && (
          <div className="mt-5 rounded border p-4">
            <div className="font-medium">Core onboarding complete</div>
            <p className="mt-1 text-sm opacity-70">
              Locations and assets are in place. The customer home now becomes
              the normal starting point for service, shipments, readiness, and
              items needing attention.
            </p>
            <Link
              href={`/organizations/${organizationId}/dashboard`}
              className="mt-3 inline-block text-sm underline"
            >
              Open customer home
            </Link>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">
          Continue when it is useful
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 opacity-70">
          These steps are operational options, not barriers to getting started.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="rounded border p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">Invite your team</h3>
              <StatusBadge complete={teamComplete} optional />
            </div>
            <p className="mt-3 text-sm leading-6 opacity-70">
              Add dispatch, helpdesk, billing, audit, or field users only when
              those people need access.
            </p>
            <div className="mt-4 text-sm">
              Current: <strong>{activeOrInvitedMemberships}</strong> members
            </div>
            {canManageUsers && (
              <Link
                href={`/organizations/${organizationId}/users`}
                className="mt-4 inline-block text-sm underline"
              >
                Manage team
              </Link>
            )}
          </article>

          <article className="rounded border p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">Prepare strategic spares</h3>
              <StatusBadge complete={stockedOrReadyAssets > 0} optional />
            </div>
            <p className="mt-3 text-sm leading-6 opacity-70">
              Mark known-good equipment ready for rapid deployment and keep
              compatibility/configuration information current.
            </p>
            <div className="mt-4 text-sm">
              Ready / stocked: <strong>{stockedOrReadyAssets}</strong>
            </div>
            {canViewSpares && (
              <Link
                href={`/organizations/${organizationId}/spares`}
                className="mt-4 inline-block text-sm underline"
              >
                Review strategic spares
              </Link>
            )}
          </article>

          <article className="rounded border p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">Begin service operations</h3>
              <StatusBadge
                complete={organization._count.spareRequisitions > 0}
                optional
              />
            </div>
            <p className="mt-3 text-sm leading-6 opacity-70">
              Request service or a replacement when an actual operational need
              occurs. Setup does not require creating fake tickets.
            </p>
            <div className="mt-4 text-sm">
              Spare requests:{" "}
              <strong>{organization._count.spareRequisitions}</strong>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {canRequestService && (
                <Link
                  href={`/organizations/${organizationId}/service`}
                  className="underline"
                >
                  Request depot service
                </Link>
              )}
              {canViewSpares && (
                <Link
                  href={`/organizations/${organizationId}/spares`}
                  className="underline"
                >
                  Request a replacement
                </Link>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="mt-10 rounded border p-5">
        <h2 className="text-xl font-semibold">Your data remains portable</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 opacity-70">
          Bulk import is not a one-way door. Authorized users can export
          endpoint and asset data from the organization workspace at any time.
        </p>
      </section>
    </main>
  );
}
