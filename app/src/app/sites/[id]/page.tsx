import Link from "next/link";
import { notFound } from "next/navigation";
import { createStorageLocation } from "@/app/actions/storage-locations";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const locationTypes = [
  "RECEIVING",
  "CAGE",
  "ROOM",
  "RACK",
  "SHELF",
  "BIN",
  "PALLET_POSITION",
  "BENCH",
  "FLOOR_POSITION",
  "OTHER",
] as const;

export default async function SitePage({ params }: PageProps) {
  const { id } = await params;

  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      organization: true,
      storageLocations: {
        orderBy: [{ parentId: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!site) {
    notFound();
  }

  const createLocationForSite = createStorageLocation.bind(
    null,
    site.id
  );

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link
        href={`/organizations/${site.organizationId}`}
        className="text-sm underline"
      >
        ← {site.organization.name}
      </Link>

      <h1 className="mt-6 text-3xl font-bold">{site.name}</h1>

      <p className="mt-2 text-sm opacity-60">
        {[site.addressLine1, site.city, site.state, site.postalCode]
          .filter(Boolean)
          .join(", ") || "No address recorded"}
      </p>

      <section className="mt-10 rounded border p-5">
        <h2 className="text-xl font-semibold">
          Add storage location
        </h2>

        <form
          action={createLocationForSite}
          className="mt-5 grid gap-3 md:grid-cols-2"
        >
          <input
            name="name"
            required
            placeholder="Name (Receiving Cage, Rack 2...)"
            className="rounded border px-3 py-2"
          />

          <input
            name="code"
            placeholder="Optional short code"
            className="rounded border px-3 py-2"
          />

          <select
            name="type"
            defaultValue="RECEIVING"
            className="rounded border px-3 py-2"
          >
            {locationTypes.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <select
            name="parentId"
            defaultValue=""
            className="rounded border px-3 py-2"
          >
            <option value="">No parent location</option>
            {site.storageLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="rounded border px-4 py-2 font-medium md:col-span-2"
          >
            Add storage location
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">
          Storage locations
        </h2>

        <div className="mt-5 space-y-3">
          {site.storageLocations.length === 0 ? (
            <p className="text-sm opacity-70">
              No storage locations defined yet.
            </p>
          ) : (
            site.storageLocations.map((location) => (
              <article
                key={location.id}
                className="rounded border p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-semibold">
                    {location.name}
                  </div>
                  <div className="text-sm">
                    {location.type.replaceAll("_", " ")}
                  </div>
                </div>

                <div className="mt-2 text-sm opacity-70">
                  Code: {location.code ?? "—"}
                </div>

                <div className="mt-1 text-sm opacity-70">
                  Parent:{" "}
                  {location.parentId
                    ? site.storageLocations.find(
                        (candidate) =>
                          candidate.id === location.parentId
                      )?.name ?? "Unknown"
                    : "None"}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
