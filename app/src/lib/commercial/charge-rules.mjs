// Pure billing rules. No database writes or time-dependent defaults.
const UNITS = new Set(["EACH", "PER_ASSET_DAY", "PER_ASSET_MONTH", "PER_HOUR", "FLAT"]);
const MAX_CENTS = Number.MAX_SAFE_INTEGER;
function assert(condition, message) { if (!condition) throw new Error(message); }
function validDate(value, label) {
  const date = new Date(value);
  assert(value != null && !Number.isNaN(date.getTime()), label + " must be a valid date");
  return date;
}
export function makeChargeDraft({ organizationId, agreement, rate, event, quantityMicros, serviceFrom, serviceTo = null }) {
  assert(typeof organizationId === "string" && organizationId.length > 0, "Organization required");
  assert(agreement?.organizationId === organizationId, "Agreement tenant mismatch");
  assert(agreement.status === "ACTIVE", "Agreement must be active");
  assert(rate?.agreementId === agreement.id, "Rate agreement mismatch");
  assert(UNITS.has(rate.unit), "Unsupported billing unit");
  assert(typeof rate.serviceCode === "string" && rate.serviceCode.length > 0, "Service code required");
  assert(typeof rate.id === "string" && rate.id.length > 0, "Rate ID required");
  assert(typeof event?.type === "string" && event.type.length > 0, "Source type required");
  assert(typeof event?.id === "string" && event.id.length > 0, "Source ID required");
  assert(Number.isSafeInteger(quantityMicros) && quantityMicros > 0, "Quantity must be a positive integer in millionths");
  assert(Number.isSafeInteger(rate.unitPriceCents) && rate.unitPriceCents >= 0, "Invalid unit price");
  assert(agreement.currency === rate.currency && /^[A-Z]{3}$/.test(rate.currency), "Currency mismatch");
  const start = validDate(serviceFrom, "Service start");
  const end = serviceTo == null ? null : validDate(serviceTo, "Service end");
  assert(!end || end >= start, "Service end precedes start");
  const agreementFrom = agreement.effectiveFrom == null ? null : validDate(agreement.effectiveFrom, "Agreement start");
  const agreementTo = agreement.effectiveTo == null ? null : validDate(agreement.effectiveTo, "Agreement end");
  const rateFrom = validDate(rate.effectiveFrom, "Rate start");
  const rateTo = rate.effectiveTo == null ? null : validDate(rate.effectiveTo, "Rate end");
  assert((!agreementFrom || start >= agreementFrom) && (!agreementTo || start < agreementTo), "Agreement not effective");
  assert(start >= rateFrom && (!rateTo || start < rateTo), "Rate not effective");
  assert(!end || ((!agreementTo || end <= agreementTo) && (!rateTo || end <= rateTo)), "Interval exceeds active agreement or rate");
  assert(!end || end > start, "Service interval must have positive duration");
  assert(rate.unit !== "FLAT" || quantityMicros === 1_000_000, "FLAT quantity must equal one");
  const raw = BigInt(quantityMicros) * BigInt(rate.unitPriceCents);
  const centsBig = (raw + 500_000n) / 1_000_000n; // nonnegative half-up
  assert(centsBig <= BigInt(MAX_CENTS), "Charge amount overflow");
  const idempotencyKey = [agreement.id, rate.id, event.type, event.id, start.toISOString(), end?.toISOString() ?? "-"].map(encodeURIComponent).join(":");
  return {
    organizationId, agreementId: agreement.id, rateId: rate.id,
    sourceType: event.type, sourceId: event.id, idempotencyKey,
    serviceCode: rate.serviceCode, description: rate.description,
    quantity: (quantityMicros / 1_000_000).toFixed(6),
    unitPriceCents: rate.unitPriceCents, amountCents: Number(centsBig),
    currency: rate.currency, serviceFrom: start, serviceTo: end, status: "DRAFT"
  };
}
