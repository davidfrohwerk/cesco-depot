import { requireOrganizationPermission } from "@/lib/access-scope";
import { csvEscape } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
    entity: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const { id: organizationId, entity } = await params;

  await requireOrganizationPermission(
    "export.create",
    organizationId
  );

  if (entity === "endpoints") {
    const endpoints = await prisma.endpoint.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });

    const headers = [
      "external_endpoint_id",
      "name",
      "endpoint_type",
      "address_line_1",
      "address_line_2",
      "city",
      "state",
      "postal_code",
      "country",
      "region",
      "contact_name",
      "contact_email",
      "contact_phone",
      "service_notes",
      "active",
    ];

    const lines = [
      headers.join(","),
      ...endpoints.map((endpoint) =>
        [
          endpoint.externalCode,
          endpoint.name,
          endpoint.type,
          endpoint.addressLine1,
          endpoint.addressLine2,
          endpoint.city,
          endpoint.state,
          endpoint.postalCode,
          endpoint.country,
          endpoint.region,
          endpoint.contactName,
          endpoint.contactEmail,
          endpoint.contactPhone,
          endpoint.serviceNotes,
          endpoint.isActive,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ];

    return new Response(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="cesco-depot-endpoints.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (entity === "assets") {
    const assets = await prisma.asset.findMany({
      where: { organizationId },
      include: { currentEndpoint: true },
      orderBy: { assetTag: "asc" },
    });

    const headers = [
      "external_asset_id",
      "asset_tag",
      "endpoint_external_id",
      "manufacturer",
      "model",
      "serial_number",
      "asset_class",
      "compatibility_class",
      "configuration_version",
      "status",
      "description",
      "last_readiness_verified_at",
      "next_readiness_due_at",
      "readiness_notes",
    ];

    const lines = [
      headers.join(","),
      ...assets.map((asset) =>
        [
          asset.externalId,
          asset.assetTag,
          asset.currentEndpoint?.externalCode,
          asset.manufacturer,
          asset.model,
          asset.serialNumber,
          asset.assetClass,
          asset.compatibilityClass,
          asset.configurationVersion,
          asset.status,
          asset.description,
          asset.lastReadinessVerifiedAt?.toISOString(),
          asset.nextReadinessDueAt?.toISOString(),
          asset.readinessNotes,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ];

    return new Response(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="cesco-depot-assets.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response("Unknown export entity.", {
    status: 404,
  });
}
