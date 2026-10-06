import Link from "next/link";
import { createOrganization } from "@/app/actions/organizations";
import { prisma } from "@/lib/prisma";

export default async function OrganizationsPage() {
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
            <Link
              key={org.id}
              href={`/organizations/${org.id}`}
              className="block rounded border p-4 hover:bg-black/5"
            >
              <div className="font-semibold">{org.name}</div>
              <div className="mt-1 text-xs opacity-60">{org.id}</div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
