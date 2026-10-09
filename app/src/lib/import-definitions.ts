export const endpointImportHeaders = [
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
] as const;

export const assetImportHeaders = [
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
] as const;

export const endpointTypes = new Set([
  "STORE",
  "CLINIC",
  "BRANCH",
  "RESTAURANT",
  "WAREHOUSE",
  "OFFICE",
  "DATA_CENTER",
  "OTHER",
]);

export const importableAssetStatuses = new Set([
  "REGISTERED",
  "READY",
  "STOCKED",
]);

export function parseBoolean(value: string) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "active"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "inactive"].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean value: ${value}`);
}

export function parseOptionalImportDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
}
