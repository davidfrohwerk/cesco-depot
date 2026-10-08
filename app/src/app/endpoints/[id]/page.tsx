import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationPagePermission } from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EndpointPage({ params }: PageProps) {
  const { id } = await params;

  const scope = await prisma.endpoint.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!scope) {
    notFound();
  }

  await requireOrganizationPagePermission(
    "endpoint.view",
    scope.organizationId
  );

  const endpoint = await prisma.endpoint.findUnique({
    where: { id },
    include: {
      organization: true,
      currentAssets: {
        orderBy: { assetTag: "asc" },
      },
    },
  });

  if (!endpoint) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link
        href={`/organizations/${endpoint.organizationId}`}
        className="text-sm underline"
      >
        ← {endpoint.organization.name}
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm opacity-60">Customer endpoint</p>
          <h1 className="text-3xl font-bold">{endpoint.name}</h1>
          <p className="mt-2 opacity-70">
            {endpoint.externalCode
              ? `${endpoint.externalCode} · `
              : ""}
            {endpoint.type.replaceAll("_", " ")}
          </p>
        </div>
        <div className="rounded border px-4 py-2 text-sm font-medium">
          {endpoint.isActive ? "ACTIVE" : "INACTIVE"}
        </div>
      </div>

      <section className="mt-8 rounded border p-5">
        <h2 className="font-semibold">Location details</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="opacity-60">Address</div>
            <div>
              {[
                endpoint.addressLine1,
                endpoint.city,
                endpoint.state,
                endpoint.postalCode,
              ]
                .filter(Boolean)
                .join(", ") || "Not recorded"}
            </div>
          </div>
          <div>
            <div className="opacity-60">Region / market</div>
            <div>{endpoint.region ?? "Not recorded"}</div>
          </div>
          <div>
            <div className="opacity-60">Contact</div>
            <div>
              {[endpoint.contactName, endpoint.contactEmail, endpoint.contactPhone]
                .filter(Boolean)
                .join(" · ") || "Not recorded"}
            </div>
          </div>
          <div>
            <div className="opacity-60">Service notes</div>
            <div>{endpoint.serviceNotes ?? "None"}</div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Assets currently at endpoint</h2>
        <div className="mt-5 space-y-3">
          {endpoint.currentAssets.length === 0 ? (
            <p className="text-sm opacity-70">
              No assets currently reference this endpoint.
            </p>
          ) : (
            endpoint.currentAssets.map((asset) => (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-semibold">{asset.assetTag}</div>
                  <div className="text-sm">{asset.status}</div>
                </div>
                <div className="mt-2 text-sm opacity-70">
                  {[asset.manufacturer, asset.model].filter(Boolean).join(" ") ||
                    "Unspecified hardware"}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
