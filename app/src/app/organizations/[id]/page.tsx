import Link from "next/link";
import { notFound } from "next/navigation";
import { createSite } from "@/app/actions/sites";
import { createAsset } from "@/app/actions/assets";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrganizationPage({ params }: PageProps) {
  await requireCurrentUser();

  const { id } = await params;

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      sites: {
        orderBy: { createdAt: "desc" },
      },
      assets: {
        orderBy: { createdAt: "desc" },
        include: {
          site: true,
        },
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

  const createAssetForOrganization = createAsset.bind(
    null,
    organization.id
  );

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link href="/organizations" className="text-sm underline">
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
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="font-semibold">{site.name}</div>

                <div className="mt-2 text-sm opacity-70">
                  {[site.addressLine1, site.city, site.state, site.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </div>

                <div className="mt-2 text-xs opacity-50">
                  Manage storage locations
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">Assets</h2>

        <form
          action={createAssetForOrganization}
          className="mt-5 grid gap-3 md:grid-cols-2"
        >
          <input
            name="assetTag"
            placeholder="CESCo asset tag"
            required
            className="rounded border px-3 py-2"
          />

          <select
            name="siteId"
            className="rounded border px-3 py-2"
            defaultValue=""
          >
            <option value="">No site assigned</option>
            {organization.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>

          <input
            name="manufacturer"
            placeholder="Manufacturer"
            className="rounded border px-3 py-2"
          />

          <input
            name="model"
            placeholder="Model"
            className="rounded border px-3 py-2"
          />

          <input
            name="serialNumber"
            placeholder="Serial number"
            className="rounded border px-3 py-2"
          />

          <input
            name="description"
            placeholder="Description"
            className="rounded border px-3 py-2"
          />

          <button
            type="submit"
            className="rounded border px-4 py-2 font-medium md:col-span-2"
          >
            Register asset
          </button>
        </form>

        <div className="mt-8 space-y-3">
          {organization.assets.length === 0 ? (
            <p className="text-sm opacity-70">
              No assets have been registered yet.
            </p>
          ) : (
            organization.assets.map((asset) => (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {asset.assetTag}
                  </div>
                  <div className="text-sm">
                    {asset.status}
                  </div>
                </div>

                <div className="mt-2 text-sm opacity-70">
                  {[asset.manufacturer, asset.model]
                    .filter(Boolean)
                    .join(" ")}
                </div>

                {asset.serialNumber && (
                  <div className="mt-1 text-sm opacity-70">
                    Serial: {asset.serialNumber}
                  </div>
                )}

                <div className="mt-1 text-sm opacity-70">
                  Site: {asset.site?.name ?? "Unassigned"}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
