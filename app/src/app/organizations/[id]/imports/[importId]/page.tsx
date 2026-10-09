import Link from "next/link";
import { notFound } from "next/navigation";
import { commitImportJob } from "@/app/actions/imports";
import {
  requireOrganizationPagePermission,
  userHasOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

function displayEntries(
  value: unknown
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).filter(
    ([, item]) => item !== null && item !== ""
  );
}

function formatImportValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

type PageProps = {
  params: Promise<{
    id: string;
    importId: string;
  }>;
};

export default async function ImportJobPage({
  params,
}: PageProps) {
  const { id: organizationId, importId } = await params;

  const user = await requireOrganizationPagePermission(
    "import.view",
    organizationId
  );

  const job = await prisma.importJob.findFirst({
    where: {
      id: importId,
      organizationId,
    },
    include: {
      organization: true,
      submittedBy: true,
      rows: {
        orderBy: { rowNumber: "asc" },
        take: 250,
      },
    },
  });

  if (!job) {
    notFound();
  }

  const canCommit = userHasOrganizationPermission(
    user,
    "import.commit",
    organizationId
  );

  const errorRows = job.rows.filter(
    (row) => row.action === "ERROR"
  );

  return (
    <main className="mx-auto max-w-7xl p-8">
      <Link
        href={`/organizations/${organizationId}/imports`}
        className="text-sm underline"
      >
        ← Bulk import
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm opacity-60">
            {job.organization.name} · {job.entityType}
          </p>
          <h1 className="text-3xl font-bold">
            {job.originalFilename}
          </h1>
          <p className="mt-2 text-sm opacity-70">
            SHA-256 {job.sourceSha256}
          </p>
        </div>
        <div className="rounded border px-4 py-2 text-sm font-medium">
          {job.status.replaceAll("_", " ")}
        </div>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Rows", job.totalRows],
          ["Create", job.createCount],
          ["Update", job.updateCount],
          ["Skip", job.skipCount],
          ["Valid", job.validRows],
          ["Errors", job.errorCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded border p-4">
            <div className="text-xs opacity-60">{label}</div>
            <div className="mt-1 text-2xl font-semibold">
              {value}
            </div>
          </div>
        ))}
      </section>

      {job.status === "VALIDATION_FAILED" && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Fix validation errors before importing
          </h2>
          <p className="mt-2 text-sm opacity-70">
            No endpoint or asset records from this import have been committed.
            Correct the source CSV and create a new import job.
          </p>
          <Link
            href={`/organizations/${organizationId}/imports/${job.id}/errors`}
            className="mt-4 inline-block underline"
          >
            Download error CSV
          </Link>
        </section>
      )}

      {job.status === "READY" && canCommit && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Validation passed
          </h2>
          <p className="mt-2 text-sm opacity-70">
            This action will write the validated rows to the organization.
            Review the preview before confirming.
          </p>
          <form
            action={commitImportJob.bind(null, job.id)}
            className="mt-4"
          >
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium"
            >
              Confirm and commit import
            </button>
          </form>
        </section>
      )}

      {job.status === "COMPLETED" && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">
            Import completed
          </h2>
          <p className="mt-2 text-sm opacity-70">
            Records were committed at{" "}
            {job.committedAt?.toLocaleString() ?? "unknown time"}.
          </p>
          <Link
            href={`/organizations/${organizationId}`}
            className="mt-4 inline-block underline"
          >
            Return to organization
          </Link>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">
          Validation preview
        </h2>
        <p className="mt-2 text-sm opacity-70">
          Review the normalized values CESCo Depot will use. The original
          uploaded row remains available for audit and troubleshooting.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-2 text-left">Row</th>
                <th className="border p-2 text-left">Action</th>
                <th className="border p-2 text-left">Normalized data</th>
                <th className="border p-2 text-left">Errors</th>
              </tr>
            </thead>
            <tbody>
              {job.rows.map((row) => (
                <tr key={row.id}>
                  <td className="border p-2 align-top">
                    {row.rowNumber}
                  </td>
                  <td className="border p-2 align-top">
                    {row.action}
                  </td>
                  <td className="border p-2 align-top">
                    <dl className="grid gap-1">
                      {displayEntries(row.normalizedData).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="grid gap-1 sm:grid-cols-[12rem_1fr]"
                          >
                            <dt className="font-medium">
                              {key
                                .replaceAll("_", " ")
                                .replace(/([a-z])([A-Z])/g, "$1 $2")}
                            </dt>
                            <dd>{formatImportValue(value)}</dd>
                          </div>
                        )
                      )}
                    </dl>
                    <details className="mt-3 text-xs opacity-70">
                      <summary className="cursor-pointer">
                        Show original uploaded row
                      </summary>
                      <pre className="mt-2 max-w-3xl whitespace-pre-wrap">
                        {JSON.stringify(row.rawData, null, 2)}
                      </pre>
                    </details>
                  </td>
                  <td className="border p-2 align-top">
                    {Array.isArray(row.validationErrors) ? (
                      <ul className="space-y-1">
                        {row.validationErrors.map((error, index) => (
                          <li key={index}>{String(error)}</li>
                        ))}
                      </ul>
                    ) : row.validationErrors ? (
                      String(row.validationErrors)
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {errorRows.length > 0 && (
          <p className="mt-4 text-sm opacity-70">
            {errorRows.length} error rows are visible in this preview.
          </p>
        )}
      </section>
    </main>
  );
}
