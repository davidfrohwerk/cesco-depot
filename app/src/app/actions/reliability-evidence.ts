"use server";

import { revalidatePath } from "next/cache";
import {
  requireInternalPermission,
  requireOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalNumber(formData: FormData, key: string) {
  const text = textValue(formData, key);
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be numeric.`);
  }
  return value;
}

export async function createReliabilityEvidence(formData: FormData) {
  const user = await requireInternalPermission("reliability_evidence.manage");

  const publisher = textValue(formData, "publisher");
  const sourceTitle = textValue(formData, "sourceTitle");
  const metricType = textValue(formData, "metricType");
  const evidenceType = textValue(formData, "evidenceType");
  const specificity = textValue(formData, "specificity");
  const confidence = textValue(formData, "confidence");

  if (!publisher || !sourceTitle) {
    throw new Error("Publisher and source title are required.");
  }

  const allowedMetricTypes = new Set([
    "FIELD_AFR",
    "FAILURE_RATE",
    "MTBF",
    "MTTF",
    "FAILURE_PROBABILITY",
    "LIFECYCLE_INTERVAL",
    "DUTY_CYCLE_LIMIT",
    "OTHER",
  ]);
  const allowedEvidenceTypes = new Set([
    "PUBLIC_FIELD",
    "OEM_FIELD",
    "OEM_PREDICTED",
    "GOVERNMENT_REFERENCE",
    "COMMERCIAL_SURROGATE",
    "RESEARCH_SURROGATE",
    "PLANNING_ASSUMPTION",
  ]);
  const allowedSpecificity = new Set([
    "EXACT_MODEL",
    "MODEL_FAMILY",
    "ASSEMBLY_CLASS",
    "COMPONENT_CLASS",
    "EQUIPMENT_CLASS",
  ]);
  const allowedConfidence = new Set([
    "HIGH",
    "MODERATE",
    "LOW",
    "INSUFFICIENT",
  ]);

  if (
    !allowedMetricTypes.has(metricType) ||
    !allowedEvidenceTypes.has(evidenceType) ||
    !allowedSpecificity.has(specificity) ||
    !allowedConfidence.has(confidence)
  ) {
    throw new Error("Invalid reliability evidence classification.");
  }

  const sourcePublished = textValue(formData, "sourcePublishedAt");
  const sourcePublishedAt = sourcePublished
    ? new Date(`${sourcePublished}T00:00:00Z`)
    : null;

  if (sourcePublishedAt && Number.isNaN(sourcePublishedAt.getTime())) {
    throw new Error("Source publication date is invalid.");
  }

  await prisma.reliabilityEvidence.create({
    data: {
      createdByUserId: user.id,
      manufacturer: textValue(formData, "manufacturer") || null,
      model: textValue(formData, "model") || null,
      modelFamily: textValue(formData, "modelFamily") || null,
      assetClass: textValue(formData, "assetClass") || null,
      metricType: metricType as
        | "FIELD_AFR"
        | "FAILURE_RATE"
        | "MTBF"
        | "MTTF"
        | "FAILURE_PROBABILITY"
        | "LIFECYCLE_INTERVAL"
        | "DUTY_CYCLE_LIMIT"
        | "OTHER",
      value: optionalNumber(formData, "value"),
      unit: textValue(formData, "unit") || null,
      evidenceType: evidenceType as
        | "PUBLIC_FIELD"
        | "OEM_FIELD"
        | "OEM_PREDICTED"
        | "GOVERNMENT_REFERENCE"
        | "COMMERCIAL_SURROGATE"
        | "RESEARCH_SURROGATE"
        | "PLANNING_ASSUMPTION",
      specificity: specificity as
        | "EXACT_MODEL"
        | "MODEL_FAMILY"
        | "ASSEMBLY_CLASS"
        | "COMPONENT_CLASS"
        | "EQUIPMENT_CLASS",
      confidence: confidence as
        | "HIGH"
        | "MODERATE"
        | "LOW"
        | "INSUFFICIENT",
      publisher,
      sourceTitle,
      sourceUrl: textValue(formData, "sourceUrl") || null,
      sourceIdentifier: textValue(formData, "sourceIdentifier") || null,
      sourcePublishedAt,
      methodology: textValue(formData, "methodology") || null,
      observed: formData.get("observed") === "on",
      populationSize: optionalNumber(formData, "populationSize") == null
        ? null
        : Math.trunc(optionalNumber(formData, "populationSize")!),
      exposureValue: optionalNumber(formData, "exposureValue"),
      exposureUnit: textValue(formData, "exposureUnit") || null,
      failureCount: optionalNumber(formData, "failureCount") == null
        ? null
        : Math.trunc(optionalNumber(formData, "failureCount")!),
      operatingEnvironment:
        textValue(formData, "operatingEnvironment") || null,
      temperatureC: optionalNumber(formData, "temperatureC"),
      dutyCycleNotes: textValue(formData, "dutyCycleNotes") || null,
      applicabilityNotes:
        textValue(formData, "applicabilityNotes") || null,
      limitations: textValue(formData, "limitations") || null,
      licenseNotes: textValue(formData, "licenseNotes") || null,
    },
  });

  revalidatePath("/reliability");
}

export async function linkReliabilityEvidence(
  populationId: string,
  formData: FormData
) {
  const evidenceId = textValue(formData, "reliabilityEvidenceId");
  if (!evidenceId) {
    throw new Error("Select a reliability evidence record.");
  }

  const population = await prisma.infrastructureAssessmentPopulation.findUnique({
    where: { id: populationId },
    select: {
      assessment: {
        select: { organizationId: true },
      },
    },
  });

  if (!population) {
    throw new Error("Assessment population not found.");
  }

  await requireOrganizationPermission(
    "assessment.manage",
    population.assessment.organizationId
  );

  const evidence = await prisma.reliabilityEvidence.findUnique({
    where: { id: evidenceId },
    select: { id: true },
  });

  if (!evidence) {
    throw new Error("Reliability evidence record not found.");
  }

  const selectedForPlanning = formData.get("selectedForPlanning") === "on";
  const transformation = textValue(formData, "transformation") || null;

  await prisma.$transaction(async (tx) => {
    if (selectedForPlanning) {
      await tx.infrastructureAssessmentEvidence.updateMany({
        where: { populationId },
        data: { selectedForPlanning: false },
      });
    }

    await tx.infrastructureAssessmentEvidence.upsert({
      where: {
        populationId_reliabilityEvidenceId: {
          populationId,
          reliabilityEvidenceId: evidenceId,
        },
      },
      update: {
        selectedForPlanning,
        transformation,
      },
      create: {
        populationId,
        reliabilityEvidenceId: evidenceId,
        selectedForPlanning,
        transformation,
      },
    });
  });

  revalidatePath(
    `/organizations/${population.assessment.organizationId}/resilience`
  );
}
