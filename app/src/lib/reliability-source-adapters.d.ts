export type ReliabilityDiscoveryPopulation = {
  manufacturer: string | null;
  model: string | null;
  assetClass: string | null;
};

export type DiscoveredReliabilityEvidence = {
  manufacturer: string | null;
  model: string | null;
  modelFamily: string | null;
  assetClass: string | null;
  metricType:
    | "FIELD_AFR"
    | "FAILURE_RATE"
    | "MTBF"
    | "MTTF"
    | "FAILURE_PROBABILITY"
    | "LIFECYCLE_INTERVAL"
    | "DUTY_CYCLE_LIMIT"
    | "OTHER";
  value: number | null;
  unit: string | null;
  evidenceType:
    | "PUBLIC_FIELD"
    | "OEM_FIELD"
    | "OEM_PREDICTED"
    | "GOVERNMENT_REFERENCE"
    | "COMMERCIAL_SURROGATE"
    | "RESEARCH_SURROGATE"
    | "PLANNING_ASSUMPTION";
  specificity:
    | "EXACT_MODEL"
    | "MODEL_FAMILY"
    | "ASSEMBLY_CLASS"
    | "COMPONENT_CLASS"
    | "EQUIPMENT_CLASS";
  confidence: "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT";
  publisher: string;
  sourceTitle: string;
  sourceUrl: string | null;
  sourceIdentifier: string | null;
  methodology: string | null;
  observed: boolean;
  operatingEnvironment: string | null;
  temperatureC: number | null;
  applicabilityNotes: string | null;
  limitations: string | null;
  licenseNotes: string | null;
  adapterKey: string;
};

export function discoverReliabilityEvidenceForPopulation(
  population: ReliabilityDiscoveryPopulation,
  options?: { fetchImpl?: typeof fetch }
): Promise<{
  candidates: DiscoveredReliabilityEvidence[];
  errors: Array<{ adapterKey: string; message: string }>;
}>;
