-- CreateEnum
CREATE TYPE "ExternalServiceCaseStatus" AS ENUM ('PLANNED', 'TO_PROVIDER_IN_TRANSIT', 'AT_PROVIDER', 'RETURN_IN_TRANSIT', 'RETURNED', 'EXCEPTION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExternalServiceShipmentLeg" AS ENUM ('TO_PROVIDER', 'FROM_PROVIDER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetStatus" ADD VALUE 'IN_TRANSIT_EXTERNAL_SERVICE';
ALTER TYPE "AssetStatus" ADD VALUE 'IN_EXTERNAL_SERVICE';

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "externalServiceCaseId" TEXT,
ADD COLUMN     "externalServiceLeg" "ExternalServiceShipmentLeg";

-- CreateTable
CREATE TABLE "ExternalServiceCase" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerCaseReference" TEXT,
    "destinationName" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "status" "ExternalServiceCaseStatus" NOT NULL DEFAULT 'PLANNED',
    "expectedReturnAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedByProviderAt" TIMESTAMP(3),
    "returnStartedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalServiceCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalServiceCase_serviceRequestId_status_idx" ON "ExternalServiceCase"("serviceRequestId", "status");

-- CreateIndex
CREATE INDEX "ExternalServiceCase_workOrderId_status_idx" ON "ExternalServiceCase"("workOrderId", "status");

-- CreateIndex
CREATE INDEX "ExternalServiceCase_assetId_status_idx" ON "ExternalServiceCase"("assetId", "status");

-- CreateIndex
CREATE INDEX "ExternalServiceCase_providerName_idx" ON "ExternalServiceCase"("providerName");

-- CreateIndex
CREATE INDEX "Shipment_externalServiceCaseId_externalServiceLeg_idx" ON "Shipment"("externalServiceCaseId", "externalServiceLeg");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_externalServiceCaseId_fkey" FOREIGN KEY ("externalServiceCaseId") REFERENCES "ExternalServiceCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalServiceCase" ADD CONSTRAINT "ExternalServiceCase_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalServiceCase" ADD CONSTRAINT "ExternalServiceCase_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalServiceCase" ADD CONSTRAINT "ExternalServiceCase_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
