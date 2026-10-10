-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EvidenceType" ADD VALUE 'FIELD_DIAGNOSTIC';
ALTER TYPE "EvidenceType" ADD VALUE 'WARRANTY_CLAIM';
ALTER TYPE "EvidenceType" ADD VALUE 'TICKET_RECORD';

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "serviceRequestId" TEXT;

-- CreateIndex
CREATE INDEX "Evidence_serviceRequestId_idx" ON "Evidence"("serviceRequestId");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
