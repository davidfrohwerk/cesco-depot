-- CreateEnum
CREATE TYPE "ShipmentDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'TRANSFER');

-- AlterEnum
ALTER TYPE "AssetStatus" ADD VALUE 'DELIVERED';

-- AlterEnum
ALTER TYPE "PackageStatus" ADD VALUE 'DELIVERED';

-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "direction" "ShipmentDirection" NOT NULL DEFAULT 'INBOUND',
ADD COLUMN     "originSiteId" TEXT;

-- CreateIndex
CREATE INDEX "Shipment_direction_idx" ON "Shipment"("direction");

-- CreateIndex
CREATE INDEX "Shipment_originSiteId_idx" ON "Shipment"("originSiteId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_originSiteId_fkey" FOREIGN KEY ("originSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
