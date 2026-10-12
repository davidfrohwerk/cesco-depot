-- AlterEnum
ALTER TYPE "ServiceType" ADD VALUE 'OEM_WARRANTY_COORDINATION';

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "warrantyExpiresAt" TIMESTAMP(3),
ADD COLUMN     "warrantyNotes" TEXT,
ADD COLUMN     "warrantyProvider" TEXT,
ADD COLUMN     "warrantyReference" TEXT;

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "externalRmaReference" TEXT,
ADD COLUMN     "externalServiceProvider" TEXT;

-- CreateIndex
CREATE INDEX "Asset_warrantyExpiresAt_idx" ON "Asset"("warrantyExpiresAt");
