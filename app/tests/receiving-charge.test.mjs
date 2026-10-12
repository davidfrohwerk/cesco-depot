import test from "node:test";
import assert from "node:assert/strict";
import { recordReceivingCharge } from "../src/lib/commercial/receiving-charge.mjs";

const agreement = {id:"a1",organizationId:"msp",status:"ACTIVE",currency:"USD",effectiveFrom:new Date("2026-10-01")};
const rate = {id:"r1",agreementId:"a1",serviceCode:"RECEIVING",description:"Intake",unit:"EACH",unitPriceCents:750,currency:"USD",effectiveFrom:new Date("2026-10-01")};
const receipt={id:"receipt1",receivedAt:new Date("2026-10-11"),package:{shipment:{serviceRequest:{organizationId:"msp"}}}};
function fixture(changes={}) {
  let calls=0, saved;
  const tx={
    serviceAgreement:{findUnique:async()=>changes.agreement??agreement},
    commercialRate:{findUnique:async()=>changes.rate??rate},
    receipt:{findUnique:async()=>changes.receipt??receipt},
    receiptReconciliation:{findUnique:async()=>changes.reconciliation === undefined ? {id:"rec-1",organizationId:"msp",receiptId:"receipt1",verifiedUnitCount:10,verifiedByUserId:"u1",verifiedAt:new Date("2026-10-11")} : changes.reconciliation},
    commercialCharge:{upsert:async(args)=>{calls++;saved=args;return args.create;}}
  };
  return {tx,get calls(){return calls},get saved(){return saved}};
}
const args={organizationId:"msp",agreementId:"a1",rateId:"r1",receiptId:"receipt1"};
test("verified ten-unit intake produces a draft $75 charge",async()=>{
 const f=fixture();const result=await recordReceivingCharge(f.tx,args);
 assert.equal(result.amountCents,7500);assert.equal(result.status,"DRAFT");
 assert.equal(f.calls,1);assert.equal(f.saved.update && Object.keys(f.saved.update).length,0);
});
test("cross-tenant receipt is rejected before write",async()=>{
 const f=fixture({receipt:{...receipt,package:{shipment:{serviceRequest:{organizationId:"other"}}}}});
 await assert.rejects(()=>recordReceivingCharge(f.tx,args),/tenant mismatch/);assert.equal(f.calls,0);
});
test("cannot bill without stored reconciliation",async()=>{
 const f=fixture({reconciliation:null});await assert.rejects(()=>recordReceivingCharge(f.tx,args),/reconciliation required/);assert.equal(f.calls,0);
});
test("rejects an unapproved or non-receiving rate",async()=>{
 const f=fixture({rate:{...rate,serviceCode:"STORAGE"}});
 await assert.rejects(()=>recordReceivingCharge(f.tx,args),/receiving rate/);assert.equal(f.calls,0);
});
test("repeated invocation uses the same scoped uniqueness key",async()=>{
 const f=fixture();await recordReceivingCharge(f.tx,args);const first=f.saved.where.organizationId_idempotencyKey;
 await recordReceivingCharge(f.tx,args);assert.deepEqual(f.saved.where.organizationId_idempotencyKey,first);
});

test("rejects a reconciliation from a different tenant",async()=>{
 const f=fixture({reconciliation:{id:"rec-1",organizationId:"other",receiptId:"receipt1",verifiedUnitCount:10,verifiedByUserId:"u1",verifiedAt:new Date("2026-10-11")}});
 await assert.rejects(()=>recordReceivingCharge(f.tx,args),/reconciliation required/);assert.equal(f.calls,0);
});
test("rejects unverified reconciliation",async()=>{
 const f=fixture({reconciliation:{id:"rec-1",organizationId:"msp",receiptId:"receipt1",verifiedUnitCount:10,verifiedByUserId:null,verifiedAt:new Date("2026-10-11")}});
 await assert.rejects(()=>recordReceivingCharge(f.tx,args),/reconciliation required/);assert.equal(f.calls,0);
});
