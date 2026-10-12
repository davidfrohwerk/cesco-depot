-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "authorizationId" TEXT,
ADD COLUMN     "shipmentId" TEXT;

-- CreateIndex
CREATE INDEX "Evidence_authorizationId_idx" ON "Evidence"("authorizationId");

-- CreateIndex
CREATE INDEX "Evidence_shipmentId_idx" ON "Evidence"("shipmentId");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "Authorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
