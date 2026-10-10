"use client";

import { useMemo, useState } from "react";

type EntityType = "ENDPOINT" | "ASSET";

type ImportProfile = {
  id: string;
  name: string;
  entityType: EntityType;
  duplicatePolicy: "CREATE_ONLY" | "UPDATE_MATCHED" | "SKIP_EXISTING";
  mapping: Record<string, string>;
};

type TargetField = {
  key: string;
  label: string;
  aliases?: string[];
};

const endpointFields: TargetField[] = [
  { key: "external_endpoint_id", label: "External endpoint ID", aliases: ["store number", "store id", "location id", "site id", "branch id"] },
  { key: "name", label: "Endpoint name", aliases: ["store name", "location name", "site name", "branch name"] },
  { key: "endpoint_type", label: "Endpoint type", aliases: ["type", "location type", "site type"] },
  { key: "address_line_1", label: "Address line 1", aliases: ["address", "street", "street address", "address1"] },
  { key: "address_line_2", label: "Address line 2", aliases: ["address2", "suite", "unit"] },
  { key: "city", label: "City" },
  { key: "state", label: "State / province", aliases: ["province"] },
  { key: "postal_code", label: "Postal code", aliases: ["zip", "zip code", "zipcode", "postal"] },
  { key: "country", label: "Country" },
  { key: "region", label: "Region / market", aliases: ["market", "territory"] },
  { key: "contact_name", label: "Contact name" },
  { key: "contact_email", label: "Contact email", aliases: ["email"] },
  { key: "contact_phone", label: "Contact phone", aliases: ["phone", "telephone"] },
  { key: "service_notes", label: "Service notes", aliases: ["notes", "instructions"] },
  { key: "active", label: "Active", aliases: ["enabled", "is active"] },
];

const assetFields: TargetField[] = [
  { key: "external_asset_id", label: "External asset ID", aliases: ["device id", "asset id", "inventory id", "client asset id"] },
  { key: "asset_tag", label: "Asset tag", aliases: ["tag", "asset tag", "device tag", "inventory tag"] },
  { key: "endpoint_external_id", label: "Endpoint external ID", aliases: ["store number", "store id", "location id", "site id", "branch id"] },
  { key: "manufacturer", label: "Manufacturer", aliases: ["oem", "make", "vendor"] },
  { key: "model", label: "Model", aliases: ["product", "product model", "device model"] },
  { key: "serial_number", label: "Serial number", aliases: ["serial", "serial no", "serial #", "sn"] },
  { key: "asset_class", label: "Asset class", aliases: ["device type", "asset type", "class", "category"] },
  { key: "compatibility_class", label: "Compatibility class", aliases: ["compatibility", "platform"] },
  { key: "configuration_version", label: "Configuration / image version", aliases: ["image version", "config version", "configuration"] },
  { key: "status", label: "Status" },
  { key: "description", label: "Description", aliases: ["notes", "asset description"] },
  { key: "last_readiness_verified_at", label: "Last readiness verified", aliases: ["last verified", "readiness verified"] },
  { key: "next_readiness_due_at", label: "Next readiness due", aliases: ["next verification", "readiness due"] },
  { key: "readiness_notes", label: "Readiness notes", aliases: ["test notes", "verification notes"] },
];

function canonical(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function parseHeaderLine(text: string) {
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  const headers: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      headers.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }

  headers.push(field.trim());
  return headers.filter(Boolean);
}

function guessMapping(headers: string[], field: TargetField) {
  const candidates = [field.key, field.label, ...(field.aliases ?? [])].map(canonical);
  return (
    headers.find((header) => candidates.includes(canonical(header))) ?? ""
  );
}

export function ImportMappingFields({
  profiles,
  endpointCount,
}: {
  profiles: ImportProfile[];
  endpointCount: number;
}) {
  const [entityType, setEntityType] = useState<EntityType>("ENDPOINT");
  const [headers, setHeaders] = useState<string[]>([]);
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicatePolicy, setDuplicatePolicy] = useState<
    "CREATE_ONLY" | "UPDATE_MATCHED" | "SKIP_EXISTING"
  >("CREATE_ONLY");
  const [selectedProfileId, setSelectedProfileId] = useState("");

  const fields = entityType === "ENDPOINT" ? endpointFields : assetFields;

  const mappedCount = useMemo(
    () => fields.filter((field) => mapping[field.key]).length,
    [fields, mapping]
  );

  async function inspectFile(file: File | undefined) {
    if (!file) {
      setHeaders([]);
      setFilename("");
      setMapping({});
      return;
    }

    const text = await file.text();
    const detected = parseHeaderLine(text.replace(/^\uFEFF/, ""));
    setHeaders(detected);
    setFilename(file.name);

    const next: Record<string, string> = {};
    for (const field of fields) {
      next[field.key] = guessMapping(detected, field);
    }
    setMapping(next);
  }

  function changeEntity(next: EntityType) {
    setEntityType(next);
    setSelectedProfileId("");
    const nextFields = next === "ENDPOINT" ? endpointFields : assetFields;
    const nextMapping: Record<string, string> = {};
    for (const field of nextFields) {
      nextMapping[field.key] = guessMapping(headers, field);
    }
    setMapping(nextMapping);
  }

  return (
    <>
      <select
        name="entityType"
        required
        value={entityType}
        onChange={(event) => changeEntity(event.target.value as EntityType)}
        className="rounded border px-3 py-2"
      >
        <option value="ENDPOINT">Endpoints</option>
        <option value="ASSET">Assets</option>
      </select>

      {entityType === "ASSET" && endpointCount === 0 && (
        <div className="rounded border p-3 text-sm md:col-span-2">
          <strong>No endpoints exist yet.</strong> You can validate an asset
          file that does not reference locations, but any mapped endpoint/store
          IDs will fail until the endpoint import is completed first.
        </div>
      )}

      <select
        name="duplicatePolicy"
        required
        value={duplicatePolicy}
        onChange={(event) =>
          setDuplicatePolicy(
            event.target.value as
              | "CREATE_ONLY"
              | "UPDATE_MATCHED"
              | "SKIP_EXISTING"
          )
        }
        className="rounded border px-3 py-2"
      >
        <option value="CREATE_ONLY">Create only — existing matches are errors</option>
        <option value="UPDATE_MATCHED">Update matched records</option>
        <option value="SKIP_EXISTING">Skip existing records</option>
      </select>

      <input
        name="file"
        type="file"
        accept=".csv,text/csv"
        required
        onChange={(event) => inspectFile(event.target.files?.[0])}
        className="rounded border px-3 py-2 md:col-span-2"
      />

      <select
        value={selectedProfileId}
        onChange={(event) => {
          const id = event.target.value;
          setSelectedProfileId(id);
          const profile = profiles.find((item) => item.id === id);
          if (!profile) return;
          setEntityType(profile.entityType);
          setDuplicatePolicy(profile.duplicatePolicy);
          setMapping(profile.mapping);
        }}
        className="rounded border px-3 py-2 md:col-span-2"
      >
        <option value="">No saved mapping profile</option>
        {profiles
          .filter((profile) => profile.entityType === entityType)
          .map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
      </select>

      <input
        name="profileName"
        placeholder="Optional: save this mapping as a reusable profile"
        className="rounded border px-3 py-2 md:col-span-2"
      />



      {headers.length > 0 && (
        <div className="rounded border p-4 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Map your columns</div>
              <div className="mt-1 text-sm opacity-70">
                {filename} · {headers.length} columns detected · {mappedCount} mapped
              </div>
            </div>
            <div className="text-xs opacity-60">
              CESCo guessed common names; review before validating.
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key} className="grid gap-1 text-sm">
                <span>{field.label}</span>
                <select
                  name={`mapping_${field.key}`}
                  value={mapping[field.key] ?? ""}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  className="rounded border px-3 py-2"
                >
                  <option value="">Not mapped</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
