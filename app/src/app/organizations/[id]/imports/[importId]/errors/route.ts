import { requireOrganizationPermission } from "@/lib/access-scope";
import { csvEscape } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
    importId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const { id: organizationId, importId } = await params;

  await requireOrganizationPermission(
    "import.view",
    organizationId
  );

  const job = await prisma.importJob.findFirst({
    where: {
      id: importId,
      organizationId,
    },
    include: {
      rows: {
        where: { action: "ERROR" },
        orderBy: { rowNumber: "asc" },
      },
    },
  });

  if (!job) {
    return new Response("Import job not found.", {
      status: 404,
    });
  }

  const lines = [
    "row_number,errors,raw_data",
    ...job.rows.map((row) =>
      [
        csvEscape(row.rowNumber),
        csvEscape(
          row.validationErrors
            ? JSON.stringify(row.validationErrors)
            : ""
        ),
        csvEscape(JSON.stringify(row.rawData)),
      ].join(",")
    ),
  ];

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="import-${job.id}-errors.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
