import {
  assetImportHeaders,
  endpointImportHeaders,
} from "@/lib/import-definitions";
import { requireOrganizationPermission } from "@/lib/access-scope";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  const { id: organizationId } = await params;
  await requireOrganizationPermission(
    "import.create",
    organizationId
  );

  const url = new URL(request.url);
  const entity = url.searchParams.get("entity");

  const headers =
    entity === "ASSET"
      ? assetImportHeaders
      : endpointImportHeaders;

  const filename =
    entity === "ASSET"
      ? "cesco-depot-assets-template.csv"
      : "cesco-depot-endpoints-template.csv";

  return new Response(headers.join(",") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
