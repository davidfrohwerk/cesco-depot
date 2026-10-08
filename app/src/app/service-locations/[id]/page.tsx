import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createStoragePosition,
  grantServiceLocationClientAccess,
} from "@/app/actions/service-locations";
import { placeAssetInStoragePosition } from "@/app/actions/asset-movements";
import {
  requireInternalPagePermission,
  userHasInternalPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ServiceLocationPage({ params }: PageProps) {
  const { id } = await params;
  const currentUser = await requireInternalPagePermission(
    "service_location.view"
  );
  const canManage = userHasInternalPermission(
    currentUser,
    "service_location.manage"
  );

  const [location, clients] = await Promise.all([
    prisma.serviceLocation.findUnique({
      where: { id },
      include: {
        positions: {
          include: {
            dedicatedOrganization: true,
            _count: {
              select: { currentAssets: true },
            },
          },
          orderBy: [{ parentId: "asc" }, { name: "asc" }],
        },
        clientAccess: {
          include: {
            organization: true,
          },
          orderBy: {
            organization: { name: "asc" },
          },
        },
      },
    }),
    prisma.organization.findMany({
      where: { kind: "CLIENT" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!location) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link href="/service-locations" className="text-sm underline">
        ← Service locations
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm opacity-60">Service location</p>
          <h1 className="text-3xl font-bold">{location.name}</h1>
          <p className="mt-2 opacity-70">
            {[location.code, location.type.replaceAll("_", " "), location.operatorLabel]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="rounded border px-4 py-2 text-sm">
          {location.climateControlled ? "Climate controlled" : "No climate flag"} ·{" "}
          {location.secureStorage ? "Secure" : "No secure-storage flag"} ·{" "}
          Custody: {location.custodyType.replaceAll("_", " ")}
        </div>
      </div>

      <section className="mt-8 rounded border p-5">
        <h2 className="font-semibold">Location</h2>
        <div className="mt-3 text-sm">
          {[location.addressLine1, location.city, location.state, location.postalCode]
            .filter(Boolean)
            .join(", ") || "No address recorded"}
        </div>
        {location.capabilities && (
          <div className="mt-2 text-sm opacity-70">
            Capabilities: {location.capabilities}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Client availability</h2>
        <p className="mt-2 text-sm opacity-70">
          A shared service location can support multiple client organizations.
          This does not expose one client's inventory to another.
        </p>

        {canManage && clients.length > 0 && (
          <form
            action={grantServiceLocationClientAccess.bind(null, location.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <select name="organizationId" required defaultValue="" className="rounded border px-3 py-2">
              <option value="" disabled>Select client organization</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <input name="notes" placeholder="Availability / contract notes" className="rounded border px-3 py-2" />
            <button type="submit" className="rounded border px-4 py-2 font-medium md:col-span-2">
              Make location available to client
            </button>
          </form>
        )}

        <div className="mt-5 space-y-2">
          {location.clientAccess.length === 0 ? (
            <p className="text-sm opacity-70">No client availability recorded yet.</p>
          ) : (
            location.clientAccess.map((access) => (
              <div key={access.organizationId} className="rounded border p-3 text-sm">
                <div className="font-medium">{access.organization.name}</div>
                {access.notes && <div className="mt-1 opacity-70">{access.notes}</div>}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Storage positions</h2>
        <p className="mt-2 text-sm opacity-70">
          Model units, cages, racks, shelves, bins, benches, and other
          identifiable positions. Positions may be shared or dedicated.
        </p>

        {canManage && (
          <form
            action={createStoragePosition.bind(null, location.id)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input name="name" required placeholder="Position name (Unit 214, Shelf 3...)" className="rounded border px-3 py-2" />
            <input name="code" placeholder="Position code" className="rounded border px-3 py-2" />
            <select name="type" defaultValue="SHELF" className="rounded border px-3 py-2">
              {["RECEIVING", "CAGE", "ROOM", "RACK", "SHELF", "BIN", "PALLET_POSITION", "BENCH", "FLOOR_POSITION", "OTHER"].map((type) => (
                <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select name="parentId" defaultValue="" className="rounded border px-3 py-2">
              <option value="">No parent position</option>
              {location.positions.map((position) => (
                <option key={position.id} value={position.id}>{position.name}</option>
              ))}
            </select>
            <select name="dedicatedOrganizationId" defaultValue="" className="rounded border px-3 py-2">
              <option value="">Shared position</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>Dedicated: {client.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input name="secureStorage" type="checkbox" />
              Secure position
            </label>
            <textarea name="environmentalNotes" placeholder="Environmental / handling notes" className="rounded border px-3 py-2 md:col-span-2" />
            <button type="submit" className="rounded border px-4 py-2 font-medium md:col-span-2">
              Add storage position
            </button>
          </form>
        )}

        <div className="mt-6 space-y-3">
          {location.positions.length === 0 ? (
            <p className="text-sm opacity-70">No storage positions defined yet.</p>
          ) : (
            location.positions.map((position) => (
              <article key={position.id} className="rounded border p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="font-semibold">{position.name}</div>
                    <div className="mt-1 text-sm opacity-70">
                      {[position.code, position.type.replaceAll("_", " ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="text-sm">{position._count.currentAssets} assets</div>
                </div>
                <div className="mt-2 text-sm opacity-70">
                  Parent:{" "}
                  {position.parentId
                    ? location.positions.find((candidate) => candidate.id === position.parentId)?.name ?? "Unknown"
                    : "None"}
                  {" · "}
                  {position.dedicatedOrganization
                    ? `Dedicated to ${position.dedicatedOrganization.name}`
                    : "Shared"}
                </div>

                {canManage && (
                  <form
                    action={placeAssetInStoragePosition.bind(null, position.id)}
                    className="mt-4 grid gap-2 md:grid-cols-2"
                  >
                    <input
                      name="assetTag"
                      required
                      placeholder="Asset tag to place here"
                      className="rounded border px-3 py-2"
                    />
                    <input
                      name="reason"
                      placeholder="Reason / ticket / instruction"
                      className="rounded border px-3 py-2"
                    />
                    <button
                      type="submit"
                      className="rounded border px-3 py-2 text-sm font-medium md:col-span-2"
                    >
                      Record asset placement
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
