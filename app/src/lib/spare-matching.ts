export type SpareCandidate = {
  id: string;
  assetTag: string;
  status: string;
  manufacturer: string | null;
  model: string | null;
  compatibilityClass: string | null;
  configurationVersion: string | null;
  lastReadinessVerifiedAt: Date | null;
  nextReadinessDueAt: Date | null;
  currentStoragePosition: {
    id: string;
    name: string;
    serviceLocation: {
      id: string;
      name: string;
      region: string | null;
    };
  } | null;
};

export type SpareNeed = {
  manufacturer: string | null;
  model: string | null;
  compatibilityClass: string | null;
  configurationVersion: string | null;
  destinationRegion: string | null;
};

function norm(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function scoreSpareCandidate(
  candidate: SpareCandidate,
  need: SpareNeed,
  now = new Date()
) {
  let score = 0;
  const reasons: string[] = [];

  const requestedCompatibility = norm(need.compatibilityClass);
  const candidateCompatibility = norm(candidate.compatibilityClass);

  if (requestedCompatibility) {
    if (candidateCompatibility !== requestedCompatibility) {
      return {
        eligible: false,
        score: -1000,
        reasons: ["Compatibility class does not match"],
      };
    }

    score += 80;
    reasons.push("Exact compatibility class");
  }

  const requestedManufacturer = norm(need.manufacturer);
  const candidateManufacturer = norm(candidate.manufacturer);
  if (requestedManufacturer) {
    if (candidateManufacturer === requestedManufacturer) {
      score += 30;
      reasons.push("Exact manufacturer");
    } else if (
      candidateManufacturer &&
      (candidateManufacturer.includes(requestedManufacturer) ||
        requestedManufacturer.includes(candidateManufacturer))
    ) {
      score += 20;
      reasons.push("Manufacturer text match");
    } else {
      score -= 20;
      reasons.push("Manufacturer differs");
    }
  }

  const requestedModel = norm(need.model);
  const candidateModel = norm(candidate.model);
  if (requestedModel) {
    if (candidateModel === requestedModel) {
      score += 40;
      reasons.push("Exact model");
    } else if (
      candidateModel &&
      (candidateModel.includes(requestedModel) ||
        requestedModel.includes(candidateModel))
    ) {
      score += 25;
      reasons.push("Model text match");
    } else {
      score -= 30;
      reasons.push("Model differs");
    }
  }

  const requestedConfig = norm(need.configurationVersion);
  const candidateConfig = norm(candidate.configurationVersion);
  if (requestedConfig) {
    if (candidateConfig === requestedConfig) {
      score += 20;
      reasons.push("Approved configuration");
    } else {
      score -= 10;
      reasons.push("Configuration may require preparation");
    }
  }

  if (
    need.destinationRegion &&
    candidate.currentStoragePosition?.serviceLocation.region &&
    norm(need.destinationRegion) ===
      norm(candidate.currentStoragePosition.serviceLocation.region)
  ) {
    score += 25;
    reasons.push("Same operational region");
  }

  if (
    candidate.nextReadinessDueAt &&
    candidate.nextReadinessDueAt.getTime() < now.getTime()
  ) {
    score -= 50;
    reasons.push("Readiness verification overdue");
  } else if (candidate.lastReadinessVerifiedAt) {
    const ageDays =
      (now.getTime() -
        candidate.lastReadinessVerifiedAt.getTime()) /
      86400000;

    if (ageDays <= 90) {
      score += 15;
      reasons.push("Recently readiness-verified");
    }
  }

  if (candidate.status === "READY") {
    score += 10;
    reasons.push("READY status");
  } else if (candidate.status === "STOCKED") {
    score += 5;
    reasons.push("STOCKED status");
  }

  return { eligible: true, score, reasons };
}
