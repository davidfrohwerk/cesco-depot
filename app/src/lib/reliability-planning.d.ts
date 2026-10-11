export type ReliabilityEvidenceInput = {
  metricType: string;
  value: number | null;
  unit: string | null;
};

export type NormalizedFailureProbability = {
  supported: boolean;
  probability: number | null;
  transformation: string | null;
  reason: string | null;
};

export function normalizeAnnualFailureProbability(
  evidence: ReliabilityEvidenceInput
): NormalizedFailureProbability;

export function poissonCdf(k: number, mean: number): number;

export function poissonServiceLevelSpareCount(
  mean: number,
  targetServiceLevel: number
): number;

export function calculateSpareScenario(input: {
  populationSize: number;
  annualFailureProbability: number;
  exposureWindowDays: number;
  targetServiceLevel: number;
  contingencyReserve?: number;
}): {
  expectedAnnualFailures: number;
  expectedDemand: number;
  recommendedSpareCount: number;
  repairPipelineReserve: number;
  contingencyReserve: number;
  totalRecommendedSpareCount: number;
};
