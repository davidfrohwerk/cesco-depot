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
  metricType: string;
  value: number | null;
  unit: string | null;
  evidenceType: string;
  specificity: string;
  confidence: string;
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
