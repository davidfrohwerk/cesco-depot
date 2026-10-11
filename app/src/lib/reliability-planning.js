export function normalizeAnnualFailureProbability(evidence) {
  const { metricType, value, unit } = evidence;

  if (value == null || !Number.isFinite(value) || value < 0) {
    return {
      supported: false,
      probability: null,
      transformation: null,
      reason: "Source record does not contain a valid non-negative numeric value.",
    };
  }

  const normalizedUnit = String(unit ?? "").trim().toLowerCase();

  if (metricType === "MTBF" || metricType === "MTTF") {
    if (!["hour", "hours", "hr", "hrs"].includes(normalizedUnit)) {
      return {
        supported: false,
        probability: null,
        transformation: null,
        reason: "MTBF/MTTF normalization currently requires the source value to be expressed in hours.",
      };
    }

    if (value <= 0) {
      return {
        supported: false,
        probability: null,
        transformation: null,
        reason: "MTBF/MTTF must be greater than zero.",
      };
    }

    const probability = 1 - Math.exp(-8760 / value);

    return {
      supported: true,
      probability,
      transformation:
        "CESCo-derived annual planning probability = 1 - exp(-8760 / source MTBF/MTTF); assumes constant hazard / exponential lifetime during the modeled useful-life interval.",
      reason: null,
    };
  }

  if (metricType === "FIELD_AFR" || metricType === "FAILURE_PROBABILITY") {
    if (["%", "percent", "percentage", "percentage points"].includes(normalizedUnit)) {
      if (value > 100) {
        return {
          supported: false,
          probability: null,
          transformation: null,
          reason: "A percentage probability cannot exceed 100.",
        };
      }

      return {
        supported: true,
        probability: value / 100,
        transformation:
          metricType === "FIELD_AFR"
            ? "Published annual failure rate expressed as percent, converted to a unit probability by dividing by 100."
            : "Published annual failure probability expressed as percent, converted to a unit probability by dividing by 100.",
        reason: null,
      };
    }

    if (["probability", "fraction", "unit probability", ""].includes(normalizedUnit)) {
      if (value > 1) {
        return {
          supported: false,
          probability: null,
          transformation: null,
          reason: "A unit probability cannot exceed 1. Use percent when the source publishes percentage points.",
        };
      }

      return {
        supported: true,
        probability: value,
        transformation:
          metricType === "FIELD_AFR"
            ? "Published annual failure rate used as a unit probability."
            : "Published annual failure probability used as supplied.",
        reason: null,
      };
    }
  }

  return {
    supported: false,
    probability: null,
    transformation: null,
    reason:
      "This metric/unit pair does not yet have an approved automatic normalization. Preserve it as evidence and enter a reviewed planning assumption instead.",
  };
}

export function poissonCdf(k, mean) {
  if (!Number.isFinite(mean) || mean < 0) {
    throw new Error("Poisson mean must be a non-negative number.");
  }
  if (!Number.isInteger(k) || k < 0) {
    throw new Error("Poisson CDF k must be a non-negative integer.");
  }

  let term = Math.exp(-mean);
  let sum = term;

  for (let i = 1; i <= k; i += 1) {
    term *= mean / i;
    sum += term;
  }

  return Math.min(1, sum);
}

export function poissonServiceLevelSpareCount(mean, targetServiceLevel) {
  if (
    !Number.isFinite(targetServiceLevel) ||
    targetServiceLevel <= 0 ||
    targetServiceLevel >= 1
  ) {
    throw new Error("Target service level must be greater than 0 and less than 1.");
  }

  if (!Number.isFinite(mean) || mean < 0) {
    throw new Error("Poisson mean must be a non-negative number.");
  }

  let k = 0;
  while (poissonCdf(k, mean) < targetServiceLevel) {
    k += 1;
    if (k > 10000) {
      throw new Error("Unable to resolve Poisson service-level quantity.");
    }
  }

  return k;
}

export function calculateSpareScenario({
  populationSize,
  annualFailureProbability,
  exposureWindowDays,
  targetServiceLevel,
  contingencyReserve = 0,
}) {
  if (!Number.isInteger(populationSize) || populationSize < 0) {
    throw new Error("Population size must be a non-negative integer.");
  }
  if (
    !Number.isFinite(annualFailureProbability) ||
    annualFailureProbability < 0 ||
    annualFailureProbability > 1
  ) {
    throw new Error("Annual failure probability must be between 0 and 1.");
  }
  if (!Number.isFinite(exposureWindowDays) || exposureWindowDays < 0) {
    throw new Error("Exposure window must be a non-negative number of days.");
  }
  if (!Number.isInteger(contingencyReserve) || contingencyReserve < 0) {
    throw new Error("Contingency reserve must be a non-negative integer.");
  }

  const expectedAnnualFailures = populationSize * annualFailureProbability;
  const expectedDemand =
    expectedAnnualFailures * (exposureWindowDays / 365);
  const recommendedSpareCount = poissonServiceLevelSpareCount(
    expectedDemand,
    targetServiceLevel
  );

  return {
    expectedAnnualFailures,
    expectedDemand,
    recommendedSpareCount,
    repairPipelineReserve: 0,
    contingencyReserve,
    totalRecommendedSpareCount:
      recommendedSpareCount + contingencyReserve,
  };
}
