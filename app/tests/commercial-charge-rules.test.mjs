import test from "node:test";
import assert from "node:assert/strict";
import { makeChargeDraft } from "../src/lib/commercial/charge-rules.mjs";
const agreement = { id: "agr-1", organizationId: "tenant-A", status: "ACTIVE", currency: "USD", effectiveFrom: "2026-10-01T00:00:00Z", effectiveTo: null };
const rate = { id: "rate-1", agreementId: "agr-1", serviceCode: "RECEIVING", description: "Unit receiving", unit: "EACH", unitPriceCents: 750, currency: "USD", effectiveFrom: "2026-10-01T00:00:00Z", effectiveTo: null };
const input = { organizationId: "tenant-A", agreement, rate, event: {type:"RECEIPT",id:"receipt-1"}, quantityMicros:10_000_000, serviceFrom:"2026-10-11T12:00:00Z" };
test("ten switches generate $75 receiving draft, without writes", () => {
 const charge = makeChargeDraft(input);
 assert.equal(charge.amountCents,7500);
 assert.equal(charge.quantity,"10.000000");
 assert.equal(charge.status,"DRAFT");
 assert.equal(charge.organizationId,"tenant-A");
});
test("same event produces deterministic idempotency key",()=> {
 assert.equal(makeChargeDraft(input).idempotencyKey,makeChargeDraft(input).idempotencyKey);
});
test("tenant mismatch fails closed",()=>assert.throws(()=>makeChargeDraft({...input,organizationId:"tenant-B"}),/tenant mismatch/));
test("inactive agreement fails closed",()=>assert.throws(()=>makeChargeDraft({...input,agreement:{...agreement,status:"DRAFT"}}),/must be active/));
test("rate from another agreement fails",()=>assert.throws(()=>makeChargeDraft({...input,rate:{...rate,agreementId:"other"}}),/Rate agreement mismatch/));
test("rate effective date is enforced",()=>assert.throws(()=>makeChargeDraft({...input,rate:{...rate,effectiveFrom:"2026-11-01T00:00:00Z"}}),/Rate not effective/));
test("currency mismatch fails",()=>assert.throws(()=>makeChargeDraft({...input,rate:{...rate,currency:"EUR"}}),/Currency mismatch/));
test("negative quantity fails",()=>assert.throws(()=>makeChargeDraft({...input,quantityMicros:-1}),/Quantity/));
test("fractional quantity rounds half-up in cents",()=> {
 const charge=makeChargeDraft({...input,quantityMicros:500_000,rate:{...rate,unitPriceCents:101}});
 assert.equal(charge.amountCents,51);
});
test("flat charge does not multiply",()=>assert.throws(()=>makeChargeDraft({...input,rate:{...rate,unit:"FLAT"}}),/FLAT quantity/));
test("charge beyond supported integer fails",()=>assert.throws(()=>makeChargeDraft({...input,quantityMicros:9_000_000_000_000,rate:{...rate,unitPriceCents:9_000_000_000}}),/overflow/));
