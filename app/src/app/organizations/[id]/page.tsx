import Link from "next/link";
import { notFound } from "next/navigation";
import { createSite } from "@/app/actions/sites";
import { createAsset } from "@/app/actions/assets";
import { createEndpoint } from "@/app/actions/endpoints";
import { requireCurrentUser } from "@/lib/auth";
import {
  requireOrganizationPagePermission,
  userHasOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    assetError?: string;
    assetTag?: string;
  }>;
};

export default async function OrganizationPage({
  params,
  searchParams,
}: PageProps) {
  const currentUser = await requireCurrentUser();

  const { id } = await params;
  const { assetError, assetTag } = await searchParams;
  await requireOrganizationPagePermission("organization.view", id);

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      sites: {
        orderBy: { createdAt: "desc" },
      },
      endpoints: {
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      },
      assets: {
        orderBy: { createdAt: "desc" },
        include: {
          site: true,
          currentEndpoint: true,
          currentStoragePosition: {
            include: {
              serviceLocation: true,
            },
          },
        },
      },
    },
  });

  if (!organization) {
    notFound();
  }

  const canManageOrganization = userHasOrganizationPermission(
    currentUser,
    "organization.manage",
    organization.id
  );
  const canManageAssets = userHasOrganizationPermission(
    currentUser,
    "asset.manage",
    organization.id
  );
  const canManageEndpoints = userHasOrganizationPermission(
    currentUser,
    "endpoint.manage",
    organization.id
  );

  const createSiteForOrganization = createSite.bind(
    null,
    organization.id
  );

  const createEndpointForOrganization = createEndpoint.bind(
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

      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
        <span className="opacity-60">
          Organization ID: {organization.id}
        </span>
        {userHasOrganizationPermission(
          currentUser,
          "organization.manage_users",
          organization.id
        ) && (
          <Link
            href={`/organizations/${organization.id}/users`}
            className="underline"
          >
            Manage users & roles
          </Link>
        )}
        {organization.kind === "CLIENT" &&
          userHasOrganizationPermission(
            currentUser,
            "spare_requisition.view",
            organization.id
          ) && (
            <Link
              href={`/organizations/${organization.id}/spares`}
              className="underline"
            >
              Strategic spares
            </Link>
          )}
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Customer endpoints</h2>
        <p className="mt-2 text-sm opacity-70">
          Stores, clinics, branches, warehouses, offices, and other locations
          where this organization deploys or supports equipment.
        </p>

        {canManageEndpoints && (
          <form
            action={createEndpointForOrganization}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input
              name="name"
              placeholder="Endpoint name (Store 123, Clinic 41...)"
              required
              className="rounded border px-3 py-2"
            />
            <input
              name="externalCode"
              placeholder="Customer/location code"
              className="rounded border px-3 py-2"
            />
            <select
              name="type"
              defaultValue="STORE"
              className="rounded border px-3 py-2"
            >
              {["STORE", "CLINIC", "BRANCH", "RESTAURANT", "WAREHOUSE", "OFFICE", "DATA_CENTER", "OTHER"].map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <input
              name="region"
              placeholder="Region / market"
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
            <textarea
              name="serviceNotes"
              placeholder="Service/access notes"
              className="rounded border px-3 py-2 md:col-span-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
            >
              Add endpoint
            </button>
          </form>
        )}

        <div className="mt-8 space-y-3">
          {organization.endpoints.length === 0 ? (
            <p className="text-sm opacity-70">
              No customer endpoints have been created yet.
            </p>
          ) : (
            organization.endpoints.map((endpoint) => (
              <Link
                key={endpoint.id}
                href={`/endpoints/${endpoint.id}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-semibold">{endpoint.name}</div>
                  <div className="text-sm">{endpoint.type.replaceAll("_", " ")}</div>
                </div>
                <div className="mt-2 text-sm opacity-70">
                  {[endpoint.externalCode, endpoint.addressLine1, endpoint.city, endpoint.state, endpoint.postalCode]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {organization.kind === "INTERNAL" && (
        <section className="mt-14">
          <h2 className="text-2xl font-semibold">Legacy service-routing sites</h2>
          <p className="mt-2 text-sm opacity-70">
            Existing prototype shipment destinations remain available while
            shipment routing is migrated to the new service-location network.
          </p>

          {canManageOrganization && (
            <form
              action={createSiteForOrganization}
              className="mt-5 grid gap-3 md:grid-cols-2"
            >
              <input name="name" placeholder="Site name" required className="rounded border px-3 py-2" />
              <input name="addressLine1" placeholder="Street address" className="rounded border px-3 py-2" />
              <input name="city" placeholder="City" className="rounded border px-3 py-2" />
              <input name="state" placeholder="State" className="rounded border px-3 py-2" />
              <input name="postalCode" placeholder="Postal code" className="rounded border px-3 py-2" />
              <button type="submit" className="rounded border px-4 py-2 font-medium">
                Add legacy site
              </button>
            </form>
          )}

          <div className="mt-8 space-y-3">
            {organization.sites.map((site) => (
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
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">Assets</h2>

        {assetError === "duplicate" && (
          <div className="mt-4 rounded border p-4 text-sm">
            Asset tag <strong>{assetTag ?? "that value"}</strong> is already
            registered. Open the existing asset below or use a different
            unique asset tag.
          </div>
        )}

        {canManageAssets && (
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
            name="endpointId"
            className="rounded border px-3 py-2"
            defaultValue=""
          >
            <option value="">No endpoint assigned</option>
            {organization.endpoints
              .filter((endpoint) => endpoint.isActive)
              .map((endpoint) => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.name}
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
            name="assetClass"
            placeholder="Asset class (POS terminal, printer, switch...)"
            className="rounded border px-3 py-2"
          />

          <input
            name="compatibilityClass"
            placeholder="Compatibility class"
            className="rounded border px-3 py-2"
          />

          <input
            name="configurationVersion"
            placeholder="Configuration / image version"
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
        )}

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
                  Location:{" "}
                  {asset.currentStoragePosition
                    ? `${asset.currentStoragePosition.serviceLocation.name} / ${asset.currentStoragePosition.name}`
                    : asset.currentEndpoint?.name ??
                      asset.site?.name ??
                      "Unassigned"}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
