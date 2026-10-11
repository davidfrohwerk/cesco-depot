"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationPermission } from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";
import {
  calculateSpareScenario,
  normalizeAnnualFailureProbability,
} from "@/lib/reliability-planning";

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Numeric assessment values must be zero or greater.");
  }

  return parsed;
}

function optionalBoolean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text || text === "UNKNOWN") return null;
  if (text === "YES") return true;
  if (text === "NO") return false;
  throw new Error("Invalid assessment selection.");
}

function clean(value: string | null | undefined) {
  const text = value?.trim();
  return text || null;
}

function groupLabel(input: {
  manufacturer: string | null;
  model: string | null;
  assetClass: string | null;
  compatibilityClass: string | null;
}) {
  const product = [input.manufacturer, input.model].filter(Boolean).join(" ");
  if (product) return product;
  if (input.compatibilityClass) return input.compatibilityClass;
  if (input.assetClass) return input.assetClass;
  return "Unclassified assets";
}

export async function createInfrastructureAssessment(
  organizationId: string,
  formData: FormData
) {
  const user = await requireOrganizationPermission(
    "assessment.manage",
    organizationId
  );

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, kind: true },
  });

  if (!organization || organization.kind !== "CLIENT") {
    throw new Error("Infrastructure assessments are available for client organizations.");
  }

  const assets = await prisma.asset.findMany({
    where: { organizationId },
    select: {
      id: true,
      manufacturer: true,
      model: true,
      assetClass: true,
      compatibilityClass: true,
    },
    orderBy: { assetTag: "asc" },
  });

  if (assets.length === 0) {
    throw new Error("Import or register assets before creating an assessment.");
  }

  const latestAssetImport = await prisma.importJob.findFirst({
    where: {
      organizationId,
      entityType: "ASSET",
      status: "COMPLETED",
    },
    orderBy: { committedAt: "desc" },
    select: { id: true },
  });

  const grouped = new Map<
    string,
    {
      manufacturer: string | null;
      model: string | null;
      assetClass: string | null;
      compatibilityClass: string | null;
      assetIds: string[];
    }
  >();

  for (const asset of assets) {
    const manufacturer = clean(asset.manufacturer);
    const model = clean(asset.model);
    const assetClass = clean(asset.assetClass);
    const compatibilityClass = clean(asset.compatibilityClass);
    const key = [
      manufacturer?.toLowerCase() ?? "",
      model?.toLowerCase() ?? "",
      assetClass?.toLowerCase() ?? "",
      compatibilityClass?.toLowerCase() ?? "",
    ].join("|");

    const existing = grouped.get(key);
    if (existing) {
      existing.assetIds.push(asset.id);
      continue;
    }

    grouped.set(key, {
      manufacturer,
      model,
      assetClass,
      compatibilityClass,
      assetIds: [asset.id],
    });
  }

  const requestedName = String(formData.get("name") ?? "").trim();
  const name =
    requestedName ||
    `${organization.name} infrastructure resilience assessment`;

  await prisma.infrastructureAssessment.create({
    data: {
      organizationId,
      createdByUserId: user.id,
      name,
      sourceImportJobId: latestAssetImport?.id ?? null,
      populations: {
        create: [...grouped.values()].map((group) => ({
          manufacturer: group.manufacturer,
          model: group.model,
          assetClass: group.assetClass,
          compatibilityClass: group.compatibilityClass,
          populationLabel: groupLabel(group),
          assetCount: group.assetIds.length,
          assets: {
            create: group.assetIds.map((assetId) => ({ assetId })),
          },
        })),
      },
    },
  });

  revalidatePath(`/organizations/${organizationId}/resilience`);
}

export async function updateAssessmentPopulation(
  populationId: string,
  formData: FormData
) {
  const population = await prisma.infrastructureAssessmentPopulation.findUnique({
    where: { id: populationId },
    select: {
      id: true,
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

  const missionCritical = optionalBoolean(formData.get("missionCritical"));
  const localRedundancy = optionalBoolean(formData.get("localRedundancy"));
  const substitutable = optionalBoolean(formData.get("substitutable"));

  await prisma.infrastructureAssessmentPopulation.update({
    where: { id: populationId },
    data: {
      missionCritical,
      criticalityNotes:
        String(formData.get("criticalityNotes") ?? "").trim() || null,
      rtoHours: optionalNumber(formData.get("rtoHours")),
      localRedundancy,
      redundancyNotes:
        String(formData.get("redundancyNotes") ?? "").trim() || null,
      procurementLeadDays: optionalNumber(formData.get("procurementLeadDays")),
      repairTurnaroundDays: optionalNumber(formData.get("repairTurnaroundDays")),
      fieldReplacementHours: optionalNumber(formData.get("fieldReplacementHours")),
      configurationHours: optionalNumber(formData.get("configurationHours")),
      substitutable,
      substituteNotes:
        String(formData.get("substituteNotes") ?? "").trim() || null,
      customerInputNotes:
        String(formData.get("customerInputNotes") ?? "").trim() || null,
    },
  });

  revalidatePath(
    `/organizations/${population.assessment.organizationId}/resilience`
  );
}


export async function generateAssessmentScenarios(
  populationId: string,
  formData: FormData
) {
  const population =
    await prisma.infrastructureAssessmentPopulation.findUnique({
      where: { id: populationId },
      include: {
        assessment: {
          select: { organizationId: true },
        },
        evidenceLinks: {
          where: { selectedForPlanning: true },
          include: { reliabilityEvidence: true },
          take: 1,
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

  const planningEvidence = population.evidenceLinks[0]?.reliabilityEvidence;
  if (!planningEvidence) {
    throw new Error(
      "Select a published reliability evidence record as the planning basis before generating scenarios."
    );
  }

  const normalized = normalizeAnnualFailureProbability({
    metricType: planningEvidence.metricType,
    value: planningEvidence.value,
    unit: planningEvidence.unit,
  });

  if (!normalized.supported || normalized.probability == null) {
    throw new Error(
      normalized.reason ??
        "The selected source cannot yet be normalized automatically."
    );
  }

  const targetServiceLevelPercent = optionalNumber(
    formData.get("targetServiceLevelPercent")
  );
  const exposureWindowDays = optionalNumber(
    formData.get("exposureWindowDays")
  );
  const lowMultiplier = optionalNumber(formData.get("lowMultiplier"));
  const stressMultiplier = optionalNumber(formData.get("stressMultiplier"));
  const contingencyReserveRaw = optionalNumber(
    formData.get("contingencyReserve")
  );

  if (
    targetServiceLevelPercent == null ||
    targetServiceLevelPercent <= 0 ||
    targetServiceLevelPercent >= 100
  ) {
    throw new Error(
      "Target service level must be greater than 0 and less than 100 percent."
    );
  }

  if (exposureWindowDays == null || exposureWindowDays < 0) {
    throw new Error("Exposure window is required.");
  }

  const low = lowMultiplier ?? 0.5;
  const stress = stressMultiplier ?? 2;
  if (low <= 0 || stress <= 0) {
    throw new Error("Scenario multipliers must be greater than zero.");
  }

  const contingencyReserve = Math.trunc(contingencyReserveRaw ?? 0);
  if (contingencyReserve < 0) {
    throw new Error("Contingency reserve cannot be negative.");
  }

  const targetServiceLevel = targetServiceLevelPercent / 100;
  const scenarios = [
    {
      kind: "LOW" as const,
      probability: Math.min(1, normalized.probability * low),
      multiplier: low,
    },
    {
      kind: "PLANNING" as const,
      probability: normalized.probability,
      multiplier: 1,
    },
    {
      kind: "STRESS" as const,
      probability: Math.min(1, normalized.probability * stress),
      multiplier: stress,
    },
  ];

  await prisma.$transaction(async (tx) => {
    for (const scenario of scenarios) {
      const result = calculateSpareScenario({
        populationSize: population.assetCount,
        annualFailureProbability: scenario.probability,
        exposureWindowDays,
        targetServiceLevel,
        contingencyReserve,
      });

      await tx.infrastructureAssessmentScenario.upsert({
        where: {
          populationId_kind: {
            populationId,
            kind: scenario.kind,
          },
        },
        update: {
          annualFailureProbability: scenario.probability,
          failureRateSource: `${planningEvidence.publisher}: ${planningEvidence.sourceTitle}`,
          exposureWindowDays,
          targetServiceLevel,
          expectedDemand: result.expectedDemand,
          recommendedSpareCount: result.recommendedSpareCount,
          repairPipelineReserve: 0,
          contingencyReserve,
          totalRecommendedSpareCount:
            result.totalRecommendedSpareCount,
          method: "POISSON",
          confidence: planningEvidence.confidence,
          assumptions: {
            sourceEvidenceId: planningEvidence.id,
            sourceMetricType: planningEvidence.metricType,
            sourceValue: planningEvidence.value,
            sourceUnit: planningEvidence.unit,
            normalization: normalized.transformation,
            scenarioMultiplier: scenario.multiplier,
            populationSize: population.assetCount,
          },
          limitations:
            "Poisson scenario assumes independent failure demand during the exposure window. Correlated/common-mode events are not represented by the statistical reserve; contingency reserve is explicit and user-supplied.",
        },
        create: {
          populationId,
          kind: scenario.kind,
          annualFailureProbability: scenario.probability,
          failureRateSource: `${planningEvidence.publisher}: ${planningEvidence.sourceTitle}`,
          exposureWindowDays,
          targetServiceLevel,
          expectedDemand: result.expectedDemand,
          recommendedSpareCount: result.recommendedSpareCount,
          repairPipelineReserve: 0,
          contingencyReserve,
          totalRecommendedSpareCount:
            result.totalRecommendedSpareCount,
          method: "POISSON",
          confidence: planningEvidence.confidence,
          assumptions: {
            sourceEvidenceId: planningEvidence.id,
            sourceMetricType: planningEvidence.metricType,
            sourceValue: planningEvidence.value,
            sourceUnit: planningEvidence.unit,
            normalization: normalized.transformation,
            scenarioMultiplier: scenario.multiplier,
            populationSize: population.assetCount,
          },
          limitations:
            "Poisson scenario assumes independent failure demand during the exposure window. Correlated/common-mode events are not represented by the statistical reserve; contingency reserve is explicit and user-supplied.",
        },
      });
    }

    await tx.infrastructureAssessment.update({
      where: { id: population.assessmentId },
      data: { status: "IN_REVIEW" },
    });

    await tx.infrastructureAssessmentEvidence.updateMany({
      where: {
        populationId,
        selectedForPlanning: true,
      },
      data: {
        transformation: normalized.transformation,
        derivedMetricValue: normalized.probability,
        derivedMetricUnit: "annual unit probability",
      },
    });
  });

  revalidatePath(
    `/organizations/${population.assessment.organizationId}/resilience`
  );
}
