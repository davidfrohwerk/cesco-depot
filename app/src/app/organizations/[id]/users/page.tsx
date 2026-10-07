import Link from "next/link";
import { notFound } from "next/navigation";
import {
  inviteOrganizationUser,
  setMembershipStatus,
} from "@/app/actions/users";
import { userHasPermission } from "@/lib/auth";
import { requireOrganizationPermission } from "@/lib/access-scope";
import { ensureDefaultAccessControl } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    invite?: string;
    added?: string;
  }>;
};

const clientRoleKeys = new Set([
  "CLIENT_ADMIN",
  "CLIENT_DISPATCHER",
  "CLIENT_BILLING",
  "CLIENT_AUDITOR",
]);

export default async function OrganizationUsersPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const currentUser = await requireOrganizationPermission(
    "organization.manage_users",
    id
  );

  await ensureDefaultAccessControl();

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        include: {
          user: true,
          roles: {
            include: {
              role: true,
            },
          },
        },
      },
    },
  });

  if (!organization) {
    notFound();
  }

  const isSystemAdmin = userHasPermission(
    currentUser,
    "system.admin"
  );

  const roles = await prisma.role.findMany({
    where: isSystemAdmin
      ? undefined
      : {
          key: {
            in: Array.from(clientRoleKeys),
          },
        },
    orderBy: { name: "asc" },
  });

  const { invite, added } = await searchParams;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link
        href={`/organizations/${organization.id}`}
        className="text-sm underline"
      >
        ← {organization.name}
      </Link>

      <div className="mt-6">
        <p className="text-sm opacity-60">Organization access</p>
        <h1 className="text-3xl font-bold">Users & roles</h1>
        <p className="mt-2 text-sm opacity-70">
          Manage membership without deleting historical identities or
          provenance records.
        </p>
      </div>

      {invite && (
        <section className="mt-8 rounded border p-5">
          <h2 className="font-semibold">Invitation created</h2>
          <p className="mt-2 text-sm opacity-70">
            Share this one-time link with the invited user. It expires in
            24 hours. CESCo Depot does not send email yet.
          </p>
          <code className="mt-4 block break-all rounded border p-3 text-sm">
            /invite/{invite}
          </code>
        </section>
      )}

      {added === "existing" && (
        <div className="mt-8 rounded border p-4 text-sm">
          Existing active user was added to this organization.
        </div>
      )}

      <section className="mt-8 rounded border p-5">
        <h2 className="text-xl font-semibold">Invite or add user</h2>

        <form
          action={inviteOrganizationUser.bind(null, organization.id)}
          className="mt-5 grid gap-3 md:grid-cols-2"
        >
          <input
            name="displayName"
            placeholder="Display name"
            className="rounded border px-3 py-2"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="rounded border px-3 py-2"
          />
          <select
            name="roleKey"
            required
            defaultValue=""
            className="rounded border px-3 py-2 md:col-span-2"
          >
            <option value="" disabled>
              Select role
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded border px-4 py-2 font-medium md:col-span-2"
          >
            Invite / add user
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Memberships</h2>

        <div className="mt-5 space-y-3">
          {organization.memberships.length === 0 ? (
            <p className="text-sm opacity-70">
              No memberships recorded.
            </p>
          ) : (
            organization.memberships.map((membership) => (
              <article
                key={membership.id}
                className="rounded border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">
                      {membership.user.displayName ??
                        membership.user.email}
                    </div>
                    <div className="mt-1 text-sm opacity-70">
                      {membership.user.email}
                    </div>
                    <div className="mt-2 text-sm">
                      {membership.roles.length > 0
                        ? membership.roles
                            .map(({ role }) => role.name)
                            .join(", ")
                        : "No role assigned"}
                    </div>
                  </div>

                  <div className="text-right text-sm">
                    <div>
                      Membership: {membership.status}
                    </div>
                    <div className="mt-1 opacity-60">
                      Account: {membership.user.status}
                    </div>
                  </div>
                </div>

                {membership.userId !== currentUser.id &&
                  membership.status !== "INVITED" && (
                  <form
                    action={setMembershipStatus.bind(
                      null,
                      organization.id,
                      membership.id
                    )}
                    className="mt-4"
                  >
                    <input
                      type="hidden"
                      name="status"
                      value={
                        membership.status === "ACTIVE"
                          ? "DISABLED"
                          : "ACTIVE"
                      }
                    />
                    <button
                      type="submit"
                      className="rounded border px-3 py-2 text-sm"
                    >
                      {membership.status === "ACTIVE"
                        ? "Disable membership"
                        : "Activate membership"}
                    </button>
                  </form>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
