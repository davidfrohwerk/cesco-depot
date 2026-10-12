import { makeChargeDraft } from "./charge-rules.mjs";

/**
 * Record a receiving charge from an explicitly reconciled receipt.
 * This service intentionally does not infer "received assets" from expected
 * PackageContent rows: expected inventory is not proof of physical receipt.
 * Caller must supply an approved reconciliation record with a stable ID.
 * A transaction-scoped Prisma client is injected so operational code can call
 * this atomically with a verified reconciliation commit.
 */
export async function recordReceivingCharge(tx, {
  organizationId, agreementId, rateId, receiptId, reconciliationId,
  verifiedUnitCount, recordedAt
}) {
  if (!organizationId || !agreementId || !rateId || !receiptId || !reconciliationId) {
    throw new Error("Missing receiving charge identifiers");
  }
  if (!Number.isSafeInteger(verifiedUnitCount) || verifiedUnitCount < 1 || verifiedUnitCount > 1_000_000) {
    throw new Error("Invalid verified unit count");
  }
  const [agreement, rate, receipt] = await Promise.all([
    tx.serviceAgreement.findUnique({where:{id:agreementId}}),
    tx.commercialRate.findUnique({where:{id:rateId}}),
    tx.receipt.findUnique({
      where:{id:receiptId},
      include:{package:{include:{shipment:{include:{serviceRequest:true}}}}}
    })
  ]);
  if (!receipt || receipt.package?.shipment?.serviceRequest?.organizationId !== organizationId) {
    throw new Error("Receipt tenant mismatch or missing receipt");
  }
  if (!agreement || !rate || rate.serviceCode !== "RECEIVING" || rate.unit !== "EACH") {
    throw new Error("Authorized receiving rate is required");
  }
  // The reconciliation ID must be independently verified by the caller.
  // This boundary cannot prove reconciliation exists until a first-class
  // reconciliation model is introduced.
  const draft = makeChargeDraft({
    organizationId, agreement, rate,
    event: {type:"RECEIPT_RECONCILIATION", id:reconciliationId},
    quantityMicros: verifiedUnitCount * 1_000_000,
    serviceFrom: recordedAt ?? receipt.receivedAt
  });
  return tx.commercialCharge.upsert({
    where:{organizationId_idempotencyKey:{
      organizationId, idempotencyKey:draft.idempotencyKey
    }},
    create:draft,
    update:{},
  });
}
