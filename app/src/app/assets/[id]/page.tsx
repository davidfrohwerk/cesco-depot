import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AssetPage({ params }: PageProps) {
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      organization: true,
      site: true,
      events: {
        orderBy: { createdAt: "desc" },
      },
      workOrders: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!asset) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link
        href={`/organizations/${asset.organizationId}`}
        className="text-sm underline"
      >
        ← {asset.organization.name}
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {asset.assetTag}
          </h1>

          <p className="mt-2 opacity-70">
            {[asset.manufacturer, asset.model]
              .filter(Boolean)
              .join(" ") || "Unspecified hardware"}
          </p>
        </div>

        <div className="rounded border px-4 py-2 font-medium">
          {asset.status}
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded border p-4">
          <h2 className="font-semibold">Asset details</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="opacity-60">Serial number</dt>
              <dd>{asset.serialNumber ?? "—"}</dd>
            </div>

            <div>
              <dt className="opacity-60">Organization</dt>
              <dd>{asset.organization.name}</dd>
            </div>

            <div>
              <dt className="opacity-60">Site</dt>
              <dd>{asset.site?.name ?? "Unassigned"}</dd>
            </div>

            <div>
              <dt className="opacity-60">Description</dt>
              <dd>{asset.description ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded border p-4">
          <h2 className="font-semibold">Work orders</h2>

          <p className="mt-4 text-sm opacity-70">
            {asset.workOrders.length === 0
              ? "No work orders yet."
              : `${asset.workOrders.length} work order(s)`}
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Asset history</h2>

        <div className="mt-5 space-y-3">
          {asset.events.length === 0 ? (
            <p className="text-sm opacity-70">
              No asset events recorded.
            </p>
          ) : (
            asset.events.map((event) => (
              <article key={event.id} className="rounded border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-semibold">
                    {event.eventType}
                  </div>

                  <time className="text-sm opacity-60">
                    {event.createdAt.toLocaleString()}
                  </time>
                </div>

                <div className="mt-2 text-sm">
                  {event.fromStatus ?? "—"} → {event.toStatus ?? "—"}
                </div>

                {event.notes && (
                  <div className="mt-2 text-sm opacity-70">
                    {event.notes}
                  </div>
                )}

                {event.actor && (
                  <div className="mt-2 text-xs opacity-50">
                    Actor: {event.actor}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
