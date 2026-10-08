import Link from "next/link";
import { createServiceLocation } from "@/app/actions/service-locations";
import {
  requireInternalPagePermission,
  userHasInternalPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

export default async function ServiceLocationsPage() {
  const currentUser = await requireInternalPagePermission(
    "service_location.view"
  );
  const canManage = userHasInternalPermission(
    currentUser,
    "service_location.manage"
  );

  const locations = await prisma.serviceLocation.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          positions: true,
          clientAccess: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl font-bold">Service locations</h1>
      <p className="mt-2 max-w-3xl text-sm opacity-70">
        CESCo-managed and partner operational nodes. These locations may hold
        client-owned inventory for more than one customer without changing
        asset ownership.
      </p>

      {canManage && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">Add service location</h2>
          <form
            action={createServiceLocation}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input name="name" required placeholder="Location name" className="rounded border px-3 py-2" />
            <input name="code" placeholder="Short code" className="rounded border px-3 py-2" />
            <select name="type" defaultValue="STORAGE_UNIT" className="rounded border px-3 py-2">
              {["DEPOT", "STORAGE_UNIT", "WAREHOUSE", "PARTNER_FACILITY", "CROSS_DOCK", "TECHNICIAN_STAGING", "OTHER"].map((type) => (
                <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
              ))}
            </select>
            <input name="operatorLabel" placeholder="Operator / provider" className="rounded border px-3 py-2" />
            <input name="addressLine1" placeholder="Street address" className="rounded border px-3 py-2" />
            <input name="city" placeholder="City" className="rounded border px-3 py-2" />
            <input name="state" placeholder="State" className="rounded border px-3 py-2" />
            <input name="postalCode" placeholder="Postal code" className="rounded border px-3 py-2" />
            <input name="region" placeholder="Region / market" className="rounded border px-3 py-2" />
            <input name="capabilities" placeholder="Capabilities (storage, repair, staging...)" className="rounded border px-3 py-2" />
            <textarea name="accessInstructions" placeholder="Access instructions" className="rounded border px-3 py-2 md:col-span-2" />
            <label className="flex items-center gap-2 text-sm">
              <input name="climateControlled" type="checkbox" />
              Climate controlled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="secureStorage" type="checkbox" />
              Secure storage
            </label>
            <button type="submit" className="rounded border px-4 py-2 font-medium md:col-span-2">
              Add service location
            </button>
          </form>
        </section>
      )}

      <section className="mt-10 space-y-3">
        {locations.length === 0 ? (
          <p className="text-sm opacity-70">No service locations defined yet.</p>
        ) : (
          locations.map((location) => (
            <Link
              key={location.id}
              href={`/service-locations/${location.id}`}
              className="block rounded border p-4 hover:bg-black/5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-semibold">{location.name}</div>
                  <div className="mt-1 text-sm opacity-70">
                    {[location.code, location.type.replaceAll("_", " "), location.city, location.state]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="text-sm">
                  {location._count.positions} positions · {location._count.clientAccess} clients
                </div>
              </div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
