-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "assetClass" TEXT,
ADD COLUMN     "compatibilityClass" TEXT,
ADD COLUMN     "configurationVersion" TEXT,
ADD COLUMN     "lastReadinessVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "nextReadinessDueAt" TIMESTAMP(3),
ADD COLUMN     "readinessNotes" TEXT;

-- AlterTable
ALTER TABLE "SpareRequisition" ADD COLUMN     "compatibilityClass" TEXT,
ADD COLUMN     "configurationVersion" TEXT,
ADD COLUMN     "returnAssetId" TEXT,
ADD COLUMN     "returnExpected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returnInstructions" TEXT;

-- CreateIndex
CREATE INDEX "SpareRequisition_returnAssetId_idx" ON "SpareRequisition"("returnAssetId");

-- AddForeignKey
ALTER TABLE "SpareRequisition" ADD CONSTRAINT "SpareRequisition_returnAssetId_fkey" FOREIGN KEY ("returnAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
