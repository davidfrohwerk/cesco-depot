import { makeChargeDraft } from "./charge-rules.mjs";

/**
 * Generate a draft receiving charge from the persisted reconciliation.
 * Must be called within an operationally authorized transaction.
 * Approval and evidence controls are enforced by the reconciliation workflow,
 * which is NOT implemented by this module.
 */
export async function recordReceivingCharge(tx, {
  organizationId, agreementId, rateId, receiptId
}) {
  if (!organizationId || !agreementId || !rateId || !receiptId) {
    throw new Error("Missing receiving charge identifiers");
  }
  const [agreement, rate, receipt, reconciliation] = await Promise.all([
    tx.serviceAgreement.findUnique({where:{id:agreementId}}),
    tx.commercialRate.findUnique({where:{id:rateId}}),
    tx.receipt.findUnique({
      where:{id:receiptId},
      include:{package:{include:{shipment:{include:{serviceRequest:true}}}}}
    }),
    tx.receiptReconciliation.findUnique({where:{receiptId}})
  ]);
  if (!receipt || receipt.package?.shipment?.serviceRequest?.organizationId !== organizationId) {
    throw new Error("Receipt tenant mismatch or missing receipt");
  }
  if (!reconciliation || reconciliation.organizationId !== organizationId ||
      reconciliation.receiptId !== receiptId ||
      !reconciliation.verifiedByUserId || !reconciliation.verifiedAt ||
      !Number.isSafeInteger(reconciliation.verifiedUnitCount) ||
      reconciliation.verifiedUnitCount < 1 || reconciliation.verifiedUnitCount > 1_000_000) {
    throw new Error("Verified receipt reconciliation required");
  }
  if (!agreement || !rate || rate.serviceCode !== "RECEIVING" || rate.unit !== "EACH") {
    throw new Error("Authorized receiving rate is required");
  }
  const draft = makeChargeDraft({
    organizationId, agreement, rate,
    event: {type:"RECEIPT_RECONCILIATION", id:reconciliation.id},
    quantityMicros: reconciliation.verifiedUnitCount * 1_000_000,
    serviceFrom: reconciliation.verifiedAt
  });
  return tx.commercialCharge.upsert({
    where:{organizationId_idempotencyKey:{
      organizationId, idempotencyKey:draft.idempotencyKey
    }},
    create:draft,
    update:{}
  });
}
