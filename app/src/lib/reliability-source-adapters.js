const CISCO_BUSINESS_350_DATASHEET =
  "https://www.cisco.com/c/en/us/products/collateral/switches/business-350-series-managed-switches/datasheet-c78-744156.html";

function norm(value) {
  return String(value ?? "").trim().toUpperCase();
}

function htmlToText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function discoverCiscoBusiness350(population, fetchImpl) {
  const model = norm(population.model);
  const manufacturer = norm(population.manufacturer);

  if (!model.startsWith("CBS350-") || (manufacturer && manufacturer !== "CISCO")) {
    return [];
  }

  const response = await fetchImpl(CISCO_BUSINESS_350_DATASHEET, {
    headers: {
      "user-agent": "CESCo-Depot-Reliability-Enrichment/1.0",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Cisco reliability source returned HTTP " + response.status + ".");
  }

  const text = htmlToText(await response.text());
  const sectionStart = text.indexOf("Mean Time Between Failure");
  if (sectionStart < 0) {
    throw new Error("Cisco MTBF section was not found in the published data sheet.");
  }

  const section = text.slice(sectionStart, sectionStart + 30000);
  const pattern = new RegExp(
    escapeRegExp(model) + "\\s+(?:Fanless|\\d+)\\s+(?:N\\/A|[^0-9]{0,80})\\s+([0-9][0-9,]{4,})",
    "i"
  );
  const match = section.match(pattern);

  if (!match) {
    throw new Error("Cisco data sheet was found, but no MTBF row could be parsed for " + model + ".");
  }

  const value = Number(match[1].replaceAll(",", ""));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Cisco MTBF value could not be parsed as a positive number.");
  }

  return [{
    manufacturer: "Cisco",
    model,
    modelFamily: "CBS350",
    assetClass: population.assetClass ?? "Network Switch",
    metricType: "MTBF",
    value,
    unit: "hours",
    evidenceType: "OEM_PREDICTED",
    specificity: "EXACT_MODEL",
    confidence: "MODERATE",
    publisher: "Cisco",
    sourceTitle: "Cisco Business 350 Series Managed Switches Data Sheet",
    sourceUrl: CISCO_BUSINESS_350_DATASHEET,
    sourceIdentifier: "c78-744156",
    methodology: "OEM-published Mean Time Between Failure (MTBF) at 25 C in the Cisco Business 350 Series data sheet.",
    observed: false,
    operatingEnvironment: "OEM reference condition",
    temperatureC: 25,
    applicabilityNotes: "Exact-model OEM reliability prediction. Suitable as a planning input when the customer operating conditions are reasonably compatible with the stated reference condition.",
    limitations: "OEM-published MTBF is a prediction/reference metric and is not an observed field AFR. Depot must preserve the constant-hazard assumption if converting MTBF to annual failure probability.",
    licenseNotes: "Public Cisco source. Store citation, parsed facts, and provenance; do not redistribute the source document itself.",
  }];
}

export const reliabilitySourceAdapters = [{
  key: "cisco-business-350",
  supports(population) {
    return norm(population.model).startsWith("CBS350-") &&
      (!norm(population.manufacturer) || norm(population.manufacturer) === "CISCO");
  },
  discover: discoverCiscoBusiness350,
}];

export async function discoverReliabilityEvidenceForPopulation(population, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const candidates = [];
  const errors = [];

  for (const adapter of reliabilitySourceAdapters) {
    if (!adapter.supports(population)) continue;
    try {
      const discovered = await adapter.discover(population, fetchImpl);
      for (const item of discovered) {
        candidates.push({ ...item, adapterKey: adapter.key });
      }
    } catch (error) {
      errors.push({
        adapterKey: adapter.key,
        message: error instanceof Error ? error.message : "Unknown reliability source adapter error.",
      });
    }
  }

  return { candidates, errors };
}
