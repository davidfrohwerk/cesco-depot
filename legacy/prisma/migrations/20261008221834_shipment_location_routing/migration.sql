-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_destinationSiteId_fkey";

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "storagePositionId" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "destinationEndpointId" TEXT,
ADD COLUMN     "destinationServiceLocationId" TEXT,
ADD COLUMN     "originEndpointId" TEXT,
ADD COLUMN     "originServiceLocationId" TEXT,
ALTER COLUMN "destinationSiteId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Receipt_storagePositionId_idx" ON "Receipt"("storagePositionId");

-- CreateIndex
CREATE INDEX "Shipment_originEndpointId_idx" ON "Shipment"("originEndpointId");

-- CreateIndex
CREATE INDEX "Shipment_destinationEndpointId_idx" ON "Shipment"("destinationEndpointId");

-- CreateIndex
CREATE INDEX "Shipment_originServiceLocationId_idx" ON "Shipment"("originServiceLocationId");

-- CreateIndex
CREATE INDEX "Shipment_destinationServiceLocationId_idx" ON "Shipment"("destinationServiceLocationId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_destinationSiteId_fkey" FOREIGN KEY ("destinationSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_originEndpointId_fkey" FOREIGN KEY ("originEndpointId") REFERENCES "Endpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_destinationEndpointId_fkey" FOREIGN KEY ("destinationEndpointId") REFERENCES "Endpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_originServiceLocationId_fkey" FOREIGN KEY ("originServiceLocationId") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_destinationServiceLocationId_fkey" FOREIGN KEY ("destinationServiceLocationId") REFERENCES "ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_storagePositionId_fkey" FOREIGN KEY ("storagePositionId") REFERENCES "StoragePosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
