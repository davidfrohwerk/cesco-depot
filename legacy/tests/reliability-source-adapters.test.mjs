import test from "node:test";
import assert from "node:assert/strict";
import { discoverReliabilityEvidenceForPopulation } from "../src/lib/reliability-source-adapters.js";

test("Cisco Business 350 adapter parses exact-model MTBF", async () => {
  const html = "<html><body><h2>Acoustic noise and Mean Time Between Failure (MTBF)</h2><table><tr><td>Model Name</td><td>FAN (Number)</td><td>Acoustic Noise</td><td>MTBF at 25 C (hours)</td></tr><tr><td>CBS350-24T-4G</td><td>Fanless</td><td>N/A</td><td>2,026,793</td></tr></table></body></html>";
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => html });
  const result = await discoverReliabilityEvidenceForPopulation(
    { manufacturer: "Cisco", model: "CBS350-24T-4G", assetClass: "Network Switch" },
    { fetchImpl }
  );
  assert.equal(result.errors.length, 0);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].value, 2026793);
  assert.equal(result.candidates[0].metricType, "MTBF");
  assert.equal(result.candidates[0].specificity, "EXACT_MODEL");
});

test("Cisco adapter ignores unrelated models", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; throw new Error("should not fetch"); };
  const result = await discoverReliabilityEvidenceForPopulation(
    { manufacturer: "Dell", model: "OptiPlex 7090", assetClass: "Desktop PC" },
    { fetchImpl }
  );
  assert.equal(called, false);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.errors.length, 0);
});
