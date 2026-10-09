import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createImportJob,
  deleteImportProfile,
} from "@/app/actions/imports";
import { ImportMappingFields } from "./import-mapping-fields";
import {
  requireOrganizationPagePermission,
  userHasOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ImportsPage({ params }: PageProps) {
  const { id: organizationId } = await params;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, kind: true },
  });

  if (!organization || organization.kind !== "CLIENT") {
    notFound();
  }

  const user = await requireOrganizationPagePermission(
    "import.view",
    organizationId
  );

  const canCreate = userHasOrganizationPermission(
    user,
    "import.create",
    organizationId
  );

  const [jobs, profiles] = await Promise.all([
    prisma.importJob.findMany({
    where: { organizationId },
    include: {
      submittedBy: true,
    },
    orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.importProfile.findMany({
      where: { organizationId },
      orderBy: [{ entityType: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link
        href={`/organizations/${organizationId}`}
        className="text-sm underline"
      >
        ← {organization.name}
      </Link>

      <h1 className="mt-6 text-3xl font-bold">
        Bulk import
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 opacity-70">
        Bring existing endpoint and asset data into CESCo Depot without
        entering records one at a time. Upload the customer's existing CSV,
        map its column names to CESCo Depot fields, then validate every row
        before operational records are written.
      </p>

      {canCreate && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Validate a CSV import
          </h2>

          <form
            action={createImportJob.bind(null, organizationId)}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <ImportMappingFields
              profiles={profiles.map((profile) => ({
                id: profile.id,
                name: profile.name,
                entityType: profile.entityType,
                duplicatePolicy: profile.duplicatePolicy,
                mapping: profile.mapping as Record<string, string>,
              }))}
            />

            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium md:col-span-2"
            >
              Upload and validate
            </button>
          </form>

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <Link
              href={`/organizations/${organizationId}/imports/template?entity=ENDPOINT`}
              className="underline"
            >
              Download endpoint CSV template
            </Link>
            <Link
              href={`/organizations/${organizationId}/imports/template?entity=ASSET`}
              className="underline"
            >
              Download asset CSV template
            </Link>
          </div>

          <p className="mt-4 text-xs opacity-60">
            Current development limits: CSV only, 5 MB maximum, 5,000 data
            rows per import.
          </p>
        </section>
      )}

      {profiles.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">
            Saved import profiles
          </h2>
          <p className="mt-2 text-sm opacity-70">
            Reuse a customer's known column layout and duplicate policy on
            future imports.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {profiles.map((profile) => (
              <article key={profile.id} className="rounded border p-4">
                <div className="font-semibold">{profile.name}</div>
                <div className="mt-1 text-sm opacity-70">
                  {profile.entityType} ·{" "}
                  {profile.duplicatePolicy.replaceAll("_", " ")}
                </div>
                <div className="mt-2 text-xs opacity-50">
                  {Object.keys(
                    profile.mapping as Record<string, string>
                  ).length}{" "}
                  mapped fields
                </div>

                {canCreate && (
                  <form
                    action={deleteImportProfile.bind(null, profile.id)}
                    className="mt-4"
                  >
                    <button
                      type="submit"
                      className="rounded border px-3 py-1 text-sm"
                    >
                      Delete profile
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Import history</h2>
        <div className="mt-5 space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm opacity-70">
              No import jobs have been created yet.
            </p>
          ) : (
            jobs.map((job) => (
              <Link
                key={job.id}
                href={`/organizations/${organizationId}/imports/${job.id}`}
                className="block rounded border p-4 hover:bg-black/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {job.originalFilename}
                    </div>
                    <div className="mt-1 text-sm opacity-70">
                      {job.entityType} · {job.duplicatePolicy}
                    </div>
                  </div>
                  <div className="rounded border px-3 py-1 text-sm">
                    {job.status.replaceAll("_", " ")}
                  </div>
                </div>

                <div className="mt-3 text-sm opacity-70">
                  {job.totalRows} rows · {job.createCount} create ·{" "}
                  {job.updateCount} update · {job.skipCount} skip ·{" "}
                  {job.errorCount} errors
                </div>
                <div className="mt-1 text-xs opacity-50">
                  Submitted by{" "}
                  {job.submittedBy.displayName ??
                    job.submittedBy.email}{" "}
                  · {job.submittedAt.toLocaleString()}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
