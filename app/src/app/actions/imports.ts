"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  requireOrganizationPermission,
} from "@/lib/access-scope";
import { parseCsv, rowsToObjects } from "@/lib/csv";
import {
  endpointImportHeaders,
  assetImportHeaders,
  endpointTypes,
  importableAssetStatuses,
  parseBoolean,
  parseOptionalImportDate,
} from "@/lib/import-definitions";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../generated/prisma/client";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;

type ImportEntity = "ENDPOINT" | "ASSET";
type DuplicatePolicy =
  | "CREATE_ONLY"
  | "UPDATE_MATCHED"
  | "SKIP_EXISTING";

function buildSubmittedMapping(
  allowed: readonly string[],
  formData: FormData
) {
  const mapping: Record<string, string> = {};
  for (const target of allowed) {
    const source = String(
      formData.get(`mapping_${target}`) ?? ""
    ).trim();
    if (source) mapping[target] = source;
  }
  return mapping;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function requireKnownHeaders(
  record: Record<string, string>,
  allowed: readonly string[]
) {
  const unknown = Object.keys(record).filter(
    (key) => !allowed.includes(key)
  );

  if (unknown.length > 0) {
    throw new Error(
      `Unsupported CSV columns: ${unknown.join(", ")}`
    );
  }
}

function applyColumnMapping(
  record: Record<string, string>,
  allowed: readonly string[],
  formData: FormData
) {
  const mapped: Record<string, string> = {};

  for (const target of allowed) {
    const selectedSource = String(
      formData.get(`mapping_${target}`) ?? ""
    ).trim();

    if (selectedSource) {
      if (!(selectedSource in record)) {
        throw new Error(
          `Mapped source column "${selectedSource}" was not found in the CSV.`
        );
      }
      mapped[target] = record[selectedSource] ?? "";
      continue;
    }

    mapped[target] = record[target] ?? "";
  }

  return mapped;
}

function normalizeEndpoint(
  record: Record<string, string>
) {
  return {
    externalCode:
      record.external_endpoint_id?.trim() || null,
    name: record.name?.trim() || "",
    type:
      record.endpoint_type?.trim().toUpperCase() ||
      "OTHER",
    addressLine1:
      record.address_line_1?.trim() || null,
    addressLine2:
      record.address_line_2?.trim() || null,
    city: record.city?.trim() || null,
    state: record.state?.trim() || null,
    postalCode: record.postal_code?.trim() || null,
    country:
      record.country?.trim().toUpperCase() || "US",
    region: record.region?.trim() || null,
    contactName:
      record.contact_name?.trim() || null,
    contactEmail:
      record.contact_email?.trim().toLowerCase() || null,
    contactPhone:
      record.contact_phone?.trim() || null,
    serviceNotes:
      record.service_notes?.trim() || null,
    isActive: parseBoolean(record.active ?? ""),
  };
}

function normalizeAsset(
  record: Record<string, string>
) {
  const lastReadinessVerifiedAt =
    parseOptionalImportDate(
      record.last_readiness_verified_at ?? ""
    );
  const nextReadinessDueAt =
    parseOptionalImportDate(
      record.next_readiness_due_at ?? ""
    );

  if (
    lastReadinessVerifiedAt &&
    nextReadinessDueAt &&
    nextReadinessDueAt < lastReadinessVerifiedAt
  ) {
    throw new Error(
      "next_readiness_due_at precedes last_readiness_verified_at"
    );
  }

  return {
    externalId:
      record.external_asset_id?.trim() || null,
    assetTag: record.asset_tag?.trim() || "",
    endpointExternalCode:
      record.endpoint_external_id?.trim() || null,
    manufacturer:
      record.manufacturer?.trim() || null,
    model: record.model?.trim() || null,
    serialNumber:
      record.serial_number?.trim() || null,
    assetClass:
      record.asset_class?.trim() || null,
    compatibilityClass:
      record.compatibility_class?.trim() || null,
    configurationVersion:
      record.configuration_version?.trim() || null,
    status:
      record.status?.trim().toUpperCase() ||
      "REGISTERED",
    description:
      record.description?.trim() || null,
    lastReadinessVerifiedAt:
      lastReadinessVerifiedAt?.toISOString() ?? null,
    nextReadinessDueAt:
      nextReadinessDueAt?.toISOString() ?? null,
    readinessNotes:
      record.readiness_notes?.trim() || null,
  };
}

export async function createImportJob(
  organizationId: string,
  formData: FormData
) {
  const user = await requireOrganizationPermission(
    "import.create",
    organizationId
  );

  const organization =
    await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { kind: true },
    });

  if (!organization || organization.kind !== "CLIENT") {
    throw new Error(
      "Bulk customer imports require a client organization."
    );
  }

  const entityType = String(
    formData.get("entityType") ?? ""
  ).trim() as ImportEntity;
  const duplicatePolicy = String(
    formData.get("duplicatePolicy") ?? ""
  ).trim() as DuplicatePolicy;
  const file = formData.get("file");

  if (
    !["ENDPOINT", "ASSET"].includes(entityType) ||
    ![
      "CREATE_ONLY",
      "UPDATE_MATCHED",
      "SKIP_EXISTING",
    ].includes(duplicatePolicy)
  ) {
    throw new Error("Import options are invalid.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A CSV file is required.");
  }

  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error("CSV exceeds the 5 MB import limit.");
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("The first import slice accepts CSV files only.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sourceSha256 = createHash("sha256")
    .update(buffer)
    .digest("hex");
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rawParsed = rowsToObjects(parseCsv(text));

  const allowedHeaders =
    entityType === "ENDPOINT"
      ? endpointImportHeaders
      : assetImportHeaders;

  const parsed = rawParsed.map(({ rowNumber, record }) => ({
    rowNumber,
    rawRecord: record,
    record: applyColumnMapping(
      record,
      allowedHeaders,
      formData
    ),
  }));

  if (parsed.length === 0) {
    throw new Error("CSV contains no data rows.");
  }

  if (parsed.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `CSV contains more than ${MAX_IMPORT_ROWS} data rows.`
    );
  }

  const rowResults: Array<{
    rowNumber: number;
    rawData: Record<string, string>;
    normalizedData: Record<string, unknown>;
    action: "CREATE" | "UPDATE" | "SKIP" | "ERROR";
    matchedRecordId: string | null;
    validationErrors: string[] | null;
    warnings: string[] | null;
  }> = [];

  if (entityType === "ENDPOINT") {
    const externalIds = parsed
      .map(({ record }) =>
        record.external_endpoint_id?.trim()
      )
      .filter(Boolean) as string[];

    const existing =
      externalIds.length > 0
        ? await prisma.endpoint.findMany({
            where: {
              organizationId,
              externalCode: { in: externalIds },
            },
            select: {
              id: true,
              externalCode: true,
            },
          })
        : [];

    const existingMap = new Map(
      existing
        .filter((item) => item.externalCode)
        .map((item) => [
          item.externalCode as string,
          item.id,
        ])
    );

    const seen = new Set<string>();

    for (const { rowNumber, rawRecord, record } of parsed) {
      const errors: string[] = [];
      let normalized: ReturnType<
        typeof normalizeEndpoint
      > | null = null;

      try {
        normalized = normalizeEndpoint(record);

        if (!normalized.name) {
          errors.push("name is required");
        }

        if (!normalized.externalCode) {
          errors.push(
            "external_endpoint_id is required in the first import slice"
          );
        }

        if (
          normalized.type &&
          !endpointTypes.has(normalized.type)
        ) {
          errors.push(
            `endpoint_type "${normalized.type}" is invalid`
          );
        }

        if (
          normalized.externalCode &&
          seen.has(normalized.externalCode)
        ) {
          errors.push(
            `external_endpoint_id "${normalized.externalCode}" is duplicated in this file`
          );
        }

        if (normalized.externalCode) {
          seen.add(normalized.externalCode);
        }
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : "Row normalization failed"
        );
      }

      const matchedRecordId =
        normalized?.externalCode
          ? existingMap.get(normalized.externalCode) ?? null
          : null;

      let action: "CREATE" | "UPDATE" | "SKIP" | "ERROR" =
        "CREATE";

      if (errors.length > 0) {
        action = "ERROR";
      } else if (matchedRecordId) {
        if (duplicatePolicy === "CREATE_ONLY") {
          errors.push(
            "matching endpoint already exists"
          );
          action = "ERROR";
        } else if (
          duplicatePolicy === "SKIP_EXISTING"
        ) {
          action = "SKIP";
        } else {
          action = "UPDATE";
        }
      }

      rowResults.push({
        rowNumber,
        rawData: rawRecord,
        normalizedData: normalized ?? {},
        action,
        matchedRecordId,
        validationErrors:
          errors.length > 0 ? errors : null,
        warnings: null,
      });
    }
  } else {
    const endpointCodes = parsed
      .map(({ record }) =>
        record.endpoint_external_id?.trim()
      )
      .filter(Boolean) as string[];

    const externalIds = parsed
      .map(({ record }) =>
        record.external_asset_id?.trim()
      )
      .filter(Boolean) as string[];

    const assetTags = parsed
      .map(({ record }) => record.asset_tag?.trim())
      .filter(Boolean) as string[];

    const [endpoints, existingByExternal, existingByTag] =
      await Promise.all([
        endpointCodes.length
          ? prisma.endpoint.findMany({
              where: {
                organizationId,
                externalCode: { in: endpointCodes },
              },
              select: {
                id: true,
                externalCode: true,
              },
            })
          : Promise.resolve([]),
        externalIds.length
          ? prisma.asset.findMany({
              where: {
                organizationId,
                externalId: { in: externalIds },
              },
              select: { id: true, externalId: true },
            })
          : Promise.resolve([]),
        assetTags.length
          ? prisma.asset.findMany({
              where: {
                organizationId,
                assetTag: { in: assetTags },
              },
              select: {
                id: true,
                assetTag: true,
                organizationId: true,
              },
            })
          : Promise.resolve([]),
      ]);

    const endpointMap = new Map(
      endpoints
        .filter((item) => item.externalCode)
        .map((item) => [
          item.externalCode as string,
          item.id,
        ])
    );
    const externalMap = new Map(
      existingByExternal
        .filter((item) => item.externalId)
        .map((item) => [
          item.externalId as string,
          item.id,
        ])
    );
    const tagMap = new Map(
      existingByTag.map((item) => [
        item.assetTag,
        item,
      ])
    );

    const seenExternal = new Set<string>();
    const seenTags = new Set<string>();

    for (const { rowNumber, rawRecord, record } of parsed) {
      const errors: string[] = [];
      let normalized: ReturnType<
        typeof normalizeAsset
      > | null = null;

      try {
        normalized = normalizeAsset(record);

        if (
          !normalized.externalId &&
          !normalized.assetTag
        ) {
          errors.push(
            "external_asset_id or asset_tag is required"
          );
        }

        if (
          normalized.status &&
          !importableAssetStatuses.has(
            normalized.status
          )
        ) {
          errors.push(
            `status "${normalized.status}" is not importable; use REGISTERED, READY, or STOCKED`
          );
        }

        if (
          normalized.endpointExternalCode &&
          !endpointMap.has(
            normalized.endpointExternalCode
          )
        ) {
          errors.push(
            `endpoint_external_id "${normalized.endpointExternalCode}" was not found in this organization`
          );
        }

        if (
          normalized.externalId &&
          seenExternal.has(normalized.externalId)
        ) {
          errors.push(
            `external_asset_id "${normalized.externalId}" is duplicated in this file`
          );
        }

        if (
          normalized.assetTag &&
          seenTags.has(normalized.assetTag)
        ) {
          errors.push(
            `asset_tag "${normalized.assetTag}" is duplicated in this file`
          );
        }

        if (normalized.externalId) {
          seenExternal.add(normalized.externalId);
        }
        if (normalized.assetTag) {
          seenTags.add(normalized.assetTag);
        }
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : "Row normalization failed"
        );
      }

      const byExternal =
        normalized?.externalId
          ? externalMap.get(normalized.externalId) ?? null
          : null;
      const tagRecord =
        normalized?.assetTag
          ? tagMap.get(normalized.assetTag) ?? null
          : null;

      if (
        byExternal &&
        tagRecord &&
        byExternal !== tagRecord.id
      ) {
        errors.push(
          "external_asset_id and asset_tag match different existing assets"
        );
      }

      const matchedRecordId =
        byExternal ?? tagRecord?.id ?? null;

      let action: "CREATE" | "UPDATE" | "SKIP" | "ERROR" =
        "CREATE";

      if (errors.length > 0) {
        action = "ERROR";
      } else if (matchedRecordId) {
        if (duplicatePolicy === "CREATE_ONLY") {
          errors.push("matching asset already exists");
          action = "ERROR";
        } else if (
          duplicatePolicy === "SKIP_EXISTING"
        ) {
          action = "SKIP";
        } else {
          action = "UPDATE";
        }
      }

      rowResults.push({
        rowNumber,
        rawData: rawRecord,
        normalizedData: normalized ?? {},
        action,
        matchedRecordId,
        validationErrors:
          errors.length > 0 ? errors : null,
        warnings: null,
      });
    }
  }

  const createCount = rowResults.filter(
    (row) => row.action === "CREATE"
  ).length;
  const updateCount = rowResults.filter(
    (row) => row.action === "UPDATE"
  ).length;
  const skipCount = rowResults.filter(
    (row) => row.action === "SKIP"
  ).length;
  const errorCount = rowResults.filter(
    (row) => row.action === "ERROR"
  ).length;

  const profileName = String(
    formData.get("profileName") ?? ""
  ).trim();
  const submittedMapping = buildSubmittedMapping(
    allowedHeaders,
    formData
  );

  if (profileName) {
    await prisma.importProfile.upsert({
      where: {
        organizationId_entityType_name: {
          organizationId,
          entityType,
          name: profileName,
        },
      },
      update: {
        mapping: toInputJson(submittedMapping),
        duplicatePolicy,
        createdByUserId: user.id,
      },
      create: {
        organizationId,
        createdByUserId: user.id,
        name: profileName,
        entityType,
        duplicatePolicy,
        mapping: toInputJson(submittedMapping),
      },
    });
  }

  const job = await prisma.importJob.create({
    data: {
      organizationId,
      submittedByUserId: user.id,
      entityType,
      sourceFormat: "CSV",
      originalFilename: file.name.slice(0, 240),
      sourceSha256,
      duplicatePolicy,
      status:
        errorCount > 0
          ? "VALIDATION_FAILED"
          : "READY",
      totalRows: rowResults.length,
      validRows: rowResults.length - errorCount,
      invalidRows: errorCount,
      createCount,
      updateCount,
      skipCount,
      errorCount,
      validatedAt: new Date(),
      rows: {
        create: rowResults.map((row) => ({
          rowNumber: row.rowNumber,
          rawData: toInputJson(row.rawData),
          normalizedData: toInputJson(row.normalizedData),
          action: row.action,
          matchedRecordId: row.matchedRecordId,
          validationErrors:
            row.validationErrors
              ? toInputJson(row.validationErrors)
              : undefined,
          warnings: row.warnings
            ? toInputJson(row.warnings)
            : undefined,
        })),
      },
    },
  });

  redirect(
    `/organizations/${organizationId}/imports/${job.id}`
  );
}

export async function commitImportJob(
  importJobId: string
) {
  const jobForAccess = await prisma.importJob.findUnique({
    where: { id: importJobId },
    select: { organizationId: true },
  });

  if (!jobForAccess) {
    throw new Error("Import job not found.");
  }

  const user = await requireOrganizationPermission(
    "import.commit",
    jobForAccess.organizationId
  );

  const job = await prisma.importJob.findUnique({
    where: { id: importJobId },
    include: {
      rows: {
        orderBy: { rowNumber: "asc" },
      },
    },
  });

  if (!job) {
    throw new Error("Import job not found.");
  }

  if (job.status !== "READY") {
    throw new Error(
      "Only a fully validated import can be committed."
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.importJob.update({
        where: { id: job.id },
        data: {
          status: "COMMITTING",
          confirmedAt: new Date(),
        },
      });

      for (const row of job.rows) {
        if (row.action === "SKIP") {
          continue;
        }

        const data =
          row.normalizedData as Record<string, unknown>;

        if (job.entityType === "ENDPOINT") {
          const endpointData = {
            externalCode:
              (data.externalCode as string | null) ?? null,
            name: String(data.name ?? ""),
            type: String(data.type ?? "OTHER") as
              | "STORE"
              | "CLINIC"
              | "BRANCH"
              | "RESTAURANT"
              | "WAREHOUSE"
              | "OFFICE"
              | "DATA_CENTER"
              | "OTHER",
            addressLine1:
              (data.addressLine1 as string | null) ?? null,
            addressLine2:
              (data.addressLine2 as string | null) ?? null,
            city: (data.city as string | null) ?? null,
            state: (data.state as string | null) ?? null,
            postalCode:
              (data.postalCode as string | null) ?? null,
            country: String(data.country ?? "US"),
            region: (data.region as string | null) ?? null,
            contactName:
              (data.contactName as string | null) ?? null,
            contactEmail:
              (data.contactEmail as string | null) ?? null,
            contactPhone:
              (data.contactPhone as string | null) ?? null,
            serviceNotes:
              (data.serviceNotes as string | null) ?? null,
            isActive: Boolean(data.isActive),
          };

          if (
            row.action === "UPDATE" &&
            row.matchedRecordId
          ) {
            await tx.endpoint.update({
              where: { id: row.matchedRecordId },
              data: endpointData,
            });
          } else {
            await tx.endpoint.create({
              data: {
                organizationId: job.organizationId,
                ...endpointData,
              },
            });
          }
        } else {
          const endpointExternalCode =
            (data.endpointExternalCode as
              | string
              | null) ?? null;

          const endpoint = endpointExternalCode
            ? await tx.endpoint.findFirst({
                where: {
                  organizationId: job.organizationId,
                  externalCode: endpointExternalCode,
                },
                select: { id: true },
              })
            : null;

          const assetData = {
            externalId:
              (data.externalId as string | null) ?? null,
            assetTag: String(data.assetTag ?? ""),
            currentEndpointId: endpoint?.id ?? null,
            currentStoragePositionId: null,
            currentCustodyType: "CUSTOMER" as const,
            manufacturer:
              (data.manufacturer as string | null) ?? null,
            model: (data.model as string | null) ?? null,
            serialNumber:
              (data.serialNumber as string | null) ?? null,
            assetClass:
              (data.assetClass as string | null) ?? null,
            compatibilityClass:
              (data.compatibilityClass as string | null) ??
              null,
            configurationVersion:
              (data.configurationVersion as string | null) ??
              null,
            status: String(data.status ?? "REGISTERED") as
              | "REGISTERED"
              | "READY"
              | "STOCKED",
            description:
              (data.description as string | null) ?? null,
            lastReadinessVerifiedAt:
              data.lastReadinessVerifiedAt
                ? new Date(
                    String(data.lastReadinessVerifiedAt)
                  )
                : null,
            nextReadinessDueAt:
              data.nextReadinessDueAt
                ? new Date(String(data.nextReadinessDueAt))
                : null,
            readinessNotes:
              (data.readinessNotes as string | null) ?? null,
          };

          let assetId: string;

          if (
            row.action === "UPDATE" &&
            row.matchedRecordId
          ) {
            const updated = await tx.asset.update({
              where: { id: row.matchedRecordId },
              data: assetData,
              select: { id: true },
            });
            assetId = updated.id;
          } else {
            const created = await tx.asset.create({
              data: {
                organizationId: job.organizationId,
                ownerOrganizationId:
                  job.organizationId,
                ...assetData,
              },
              select: { id: true },
            });
            assetId = created.id;
          }

          await tx.assetEvent.create({
            data: {
              assetId,
              eventType:
                row.action === "UPDATE"
                  ? "ASSET_IMPORT_UPDATED"
                  : "ASSET_IMPORTED",
              actor:
                user.displayName ?? user.email,
              notes: `Imported from ${job.originalFilename}, row ${row.rowNumber}.`,
            },
          });
        }
      }

      await tx.importJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          committedAt: new Date(),
        },
      });
    });
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "COMMIT_FAILED" },
    });
    throw error;
  }

  revalidatePath(
    `/organizations/${job.organizationId}`
  );
  revalidatePath(
    `/organizations/${job.organizationId}/imports`
  );
  redirect(
    `/organizations/${job.organizationId}/imports/${job.id}`
  );
}
