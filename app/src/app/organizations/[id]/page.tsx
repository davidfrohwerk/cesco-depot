import Link from "next/link";
import { notFound } from "next/navigation";
import { createSite } from "@/app/actions/sites";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrganizationPage({ params }: PageProps) {
  const { id } = await params;

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      sites: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!organization) {
    notFound();
  }

  const createSiteForOrganization = createSite.bind(
    null,
    organization.id
  );

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link
        href="/organizations"
        className="text-sm underline"
      >
        ← Organizations
      </Link>

      <h1 className="mt-6 text-3xl font-bold">
        {organization.name}
      </h1>

      <p className="mt-2 text-sm opacity-60">
        Organization ID: {organization.id}
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Sites</h2>

        <form
          action={createSiteForOrganization}
          className="mt-5 grid gap-3 md:grid-cols-2"
        >
          <input
            name="name"
            placeholder="Site name"
            required
            className="rounded border px-3 py-2"
          />

          <input
            name="addressLine1"
            placeholder="Street address"
            className="rounded border px-3 py-2"
          />

          <input
            name="city"
            placeholder="City"
            className="rounded border px-3 py-2"
          />

          <input
            name="state"
            placeholder="State"
            className="rounded border px-3 py-2"
          />

          <input
            name="postalCode"
            placeholder="Postal code"
            className="rounded border px-3 py-2"
          />

          <button
            type="submit"
            className="rounded border px-4 py-2 font-medium"
          >
            Add site
          </button>
        </form>

        <div className="mt-8 space-y-3">
          {organization.sites.length === 0 ? (
            <p className="text-sm opacity-70">
              No sites have been created yet.
            </p>
          ) : (
            organization.sites.map((site) => (
              <article key={site.id} className="rounded border p-4">
                <div className="font-semibold">{site.name}</div>

                <div className="mt-2 text-sm opacity-70">
                  {[site.addressLine1, site.city, site.state, site.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </div>

                <div className="mt-2 text-xs opacity-50">
                  {site.id}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
