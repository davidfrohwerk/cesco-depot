"use server";

import { revalidatePath } from "next/cache";
import { requireInternalPermission } from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

/**
 * Initial strict-match receiving verification:
 * only counts actually inspected by an internal operator, with no variance.
 * Exceptions/discrepancies will use a separate resolution workflow.
 * Billing is intentionally not triggered until agreement selection and
 * charge authorization are integrated.
 */
export async function verifyReceivedPackage(formData: FormData) {
  const user = await requireInternalPermission("inventory.receive");
  const receiptId = String(formData.get("receiptId") ?? "").trim();
  const countText = String(formData.get("verifiedUnitCount") ?? "").trim();
  const evidenceNotes = String(formData.get("evidenceNotes") ?? "").trim();
  if (!receiptId || !/^[1-9][0-9]{0,5}$/.test(countText)) {
    throw new Error("A receipt and positive whole-unit count are required.");
  }
  if (evidenceNotes.length < 15 || evidenceNotes.length > 2000) {
    throw new Error("Inspection notes must be 15–2000 characters.");
  }
  const verifiedUnitCount = Number(countText);
  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findUnique({
      where: { id: receiptId },
      include: {
        reconciliation: true,
        package: {
          include: {
            contents: true,
            shipment: { include: { serviceRequest: true } }
          }
        }
      }
    });
    if (!receipt || receipt.reconciliation) {
      throw new Error("Receipt not found or already verified.");
    }
    const pkg = receipt.package;
    if (pkg.status !== "RECEIVED" || pkg.shipment.direction !== "INBOUND" ||
        pkg.shipment.externalServiceCaseId ||
        pkg.shipment.serviceRequest.organizationId.length === 0) {
      throw new Error("Receipt is not eligible for standard inbound verification.");
    }
    if (receipt.condition !== "GOOD" || receipt.sealIntact === false) {
      throw new Error("Condition or seal exception requires separate handling.");
    }
    const expected = pkg.contents.filter(c => c.expected);
    if (expected.length === 0 ||
        expected.some(c => !Number.isSafeInteger(c.quantity) || c.quantity < 1)) {
      throw new Error("No valid expected contents to reconcile.");
    }
    const expectedCount = expected.reduce((sum,c) => sum+c.quantity,0);
    if (!Number.isSafeInteger(expectedCount) || expectedCount !== verifiedUnitCount) {
      throw new Error("Quantity discrepancy requires exception handling.");
    }
    const created = await tx.receiptReconciliation.create({
      data: {
        receiptId,
        organizationId: pkg.shipment.serviceRequest.organizationId,
        verifiedUnitCount,
        verifiedByUserId: user.id,
        verifiedAt: new Date(),
        evidenceNotes
      }
    });
    return { id: created.id, requestId: pkg.shipment.serviceRequestId };
  });
  revalidatePath("/operations/receiving");
  revalidatePath(`/service-requests/${result.requestId}`);
  return result.id;
}
