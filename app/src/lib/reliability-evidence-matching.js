import { normalizeAnnualFailureProbability } from "./reliability-planning.js";

const specificityRank = {
  EXACT_MODEL: 500,
  MODEL_FAMILY: 400,
  ASSEMBLY_CLASS: 300,
  COMPONENT_CLASS: 200,
  EQUIPMENT_CLASS: 100,
};

const evidenceTypeRank = {
  PUBLIC_FIELD: 700,
  OEM_FIELD: 650,
  OEM_PREDICTED: 600,
  GOVERNMENT_REFERENCE: 500,
  COMMERCIAL_SURROGATE: 400,
  RESEARCH_SURROGATE: 300,
  PLANNING_ASSUMPTION: 100,
};

const confidenceRank = {
  HIGH: 30,
  MODERATE: 20,
  LOW: 10,
  INSUFFICIENT: 0,
};

function norm(value) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesPopulation(evidence, population) {
  const em = norm(evidence.manufacturer);
  const pm = norm(population.manufacturer);
  const model = norm(evidence.model);
  const populationModel = norm(population.model);
  const family = norm(evidence.modelFamily);
  const assetClass = norm(evidence.assetClass);
  const populationClass = norm(population.assetClass);

  if (evidence.specificity === "EXACT_MODEL") {
    return Boolean(model && populationModel && model === populationModel && (!em || !pm || em === pm));
  }

  if (evidence.specificity === "MODEL_FAMILY") {
    return Boolean(
      family &&
      populationModel &&
      (populationModel.includes(family) || family.includes(populationModel)) &&
      (!em || !pm || em === pm)
    );
  }

  if (
    evidence.specificity === "EQUIPMENT_CLASS" ||
    evidence.specificity === "ASSEMBLY_CLASS" ||
    evidence.specificity === "COMPONENT_CLASS"
  ) {
    return Boolean(assetClass && populationClass && assetClass === populationClass);
  }

  return false;
}

export function rankReliabilityEvidenceForPopulation(evidenceRecords, population) {
  return evidenceRecords
    .filter((evidence) => matchesPopulation(evidence, population))
    .map((evidence) => {
      const normalized = normalizeAnnualFailureProbability({
        metricType: evidence.metricType,
        value: evidence.value,
        unit: evidence.unit,
      });

      const score =
        (specificityRank[evidence.specificity] ?? 0) +
        (evidenceTypeRank[evidence.evidenceType] ?? 0) +
        (confidenceRank[evidence.confidence] ?? 0) +
        (normalized.supported ? 50 : 0);

      return {
        evidence,
        score,
        canPlanAutomatically: normalized.supported,
        normalized,
      };
    })
    .sort((a, b) => b.score - a.score);
}
