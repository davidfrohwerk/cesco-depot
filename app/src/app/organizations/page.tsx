import Link from "next/link";
import { createOrganization } from "@/app/actions/organizations";
import {
  requireCurrentUser,
  userHasPermission,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function OrganizationsPage() {
  const currentUser = await requireCurrentUser();

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Organizations</h1>

      <p className="mt-2 text-sm opacity-70">
        Clients and participating organizations using CESCo Depot services.
      </p>

      <form action={createOrganization} className="mt-8 flex gap-3">
        <input
          name="name"
          placeholder="Organization name"
          required
          className="flex-1 rounded border px-3 py-2"
        />

        <button
          type="submit"
          className="rounded border px-4 py-2 font-medium"
        >
          Add organization
        </button>
      </form>

      <section className="mt-8 space-y-3">
        {organizations.length === 0 ? (
          <p className="text-sm opacity-70">
            No organizations have been created yet.
          </p>
        ) : (
          organizations.map((org) => (
            <article
              key={org.id}
              className="rounded border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/organizations/${org.id}`}
                    className="font-semibold underline"
                  >
                    {org.name}
                  </Link>
                  <div className="mt-1 text-xs opacity-60">
                    {org.id}
                  </div>
                </div>

                {userHasPermission(
                  currentUser,
                  "organization.manage_users",
                  org.id
                ) && (
                  <Link
                    href={`/organizations/${org.id}/users`}
                    className="rounded border px-3 py-2 text-sm font-medium"
                  >
                    Users & roles
                  </Link>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
