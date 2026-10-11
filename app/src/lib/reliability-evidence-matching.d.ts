export type PopulationEvidenceTarget = {
  manufacturer: string | null;
  model: string | null;
  assetClass: string | null;
};

export type ReliabilityEvidenceCandidate = {
  id: string;
  manufacturer: string | null;
  model: string | null;
  modelFamily: string | null;
  assetClass: string | null;
  metricType: string;
  value: number | null;
  unit: string | null;
  evidenceType: string;
  specificity: string;
  confidence: string;
};

export function rankReliabilityEvidenceForPopulation(
  evidenceRecords: ReliabilityEvidenceCandidate[],
  population: PopulationEvidenceTarget
): Array<{
  evidence: ReliabilityEvidenceCandidate;
  score: number;
  canPlanAutomatically: boolean;
  normalized: {
    supported: boolean;
    probability: number | null;
    transformation: string | null;
    reason: string | null;
  };
}>;
