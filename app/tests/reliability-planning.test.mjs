import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSpareScenario,
  normalizeAnnualFailureProbability,
  poissonCdf,
  poissonServiceLevelSpareCount,
} from "../src/lib/reliability-planning.js";

test("normalizes MTBF hours using exponential constant-hazard assumption", () => {
  const result = normalizeAnnualFailureProbability({
    metricType: "MTBF",
    value: 2026793,
    unit: "hours",
  });

  assert.equal(result.supported, true);
  assert.ok(result.probability > 0.004 && result.probability < 0.005);
  assert.match(result.transformation, /constant hazard/i);
});

test("normalizes published AFR percentage without calling it OEM-derived", () => {
  const result = normalizeAnnualFailureProbability({
    metricType: "FIELD_AFR",
    value: 1.36,
    unit: "%",
  });

  assert.equal(result.supported, true);
  assert.equal(result.probability, 0.0136);
});

test("rejects unsupported metric/unit pairs", () => {
  const result = normalizeAnnualFailureProbability({
    metricType: "FAILURE_RATE",
    value: 10,
    unit: "FIT",
  });

  assert.equal(result.supported, false);
  assert.equal(result.probability, null);
});

test("poisson cdf for zero events equals exp(-mean)", () => {
  assert.ok(Math.abs(poissonCdf(0, 0.5) - Math.exp(-0.5)) < 1e-12);
});

test("poisson service-level quantity returns smallest satisfying integer", () => {
  assert.equal(poissonServiceLevelSpareCount(0.5, 0.95), 2);
  assert.ok(poissonCdf(1, 0.5) < 0.95);
  assert.ok(poissonCdf(2, 0.5) >= 0.95);
});

test("spare scenario separates statistical reserve from explicit contingency", () => {
  const result = calculateSpareScenario({
    populationSize: 100,
    annualFailureProbability: 0.03,
    exposureWindowDays: 30,
    targetServiceLevel: 0.99,
    contingencyReserve: 1,
  });

  assert.ok(result.expectedDemand > 0);
  assert.equal(
    result.totalRecommendedSpareCount,
    result.recommendedSpareCount + 1
  );
  assert.equal(result.repairPipelineReserve, 0);
});
