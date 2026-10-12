-- Additive receipt-reconciliation foundation. Apply only to isolated reset database after verification.
CREATE TABLE "ReceiptReconciliation" (
 "id" TEXT NOT NULL,
 "receiptId" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "verifiedUnitCount" INTEGER NOT NULL,
 "verifiedByUserId" TEXT NOT NULL,
 "verifiedAt" TIMESTAMP(3) NOT NULL,
 "evidenceNotes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReceiptReconciliation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ReceiptReconciliation_verifiedUnitCount_check" CHECK ("verifiedUnitCount" > 0)
);
CREATE UNIQUE INDEX "ReceiptReconciliation_receiptId_key" ON "ReceiptReconciliation"("receiptId");
CREATE INDEX "ReceiptReconciliation_organizationId_verifiedAt_idx" ON "ReceiptReconciliation"("organizationId","verifiedAt");
ALTER TABLE "ReceiptReconciliation" ADD CONSTRAINT "ReceiptReconciliation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptReconciliation" ADD CONSTRAINT "ReceiptReconciliation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptReconciliation" ADD CONSTRAINT "ReceiptReconciliation_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
