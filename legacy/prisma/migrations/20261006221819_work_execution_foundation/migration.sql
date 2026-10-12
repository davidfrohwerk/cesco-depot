-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('UNKNOWN', 'GOOD', 'KNOWN_GOOD', 'COSMETIC_DAMAGE', 'SHIPPING_DAMAGE', 'FAILED', 'INTERMITTENT', 'REPAIRABLE', 'NONREPAIRABLE', 'PARTS_ONLY', 'DATA_BEARING', 'TEST_PENDING');

-- CreateEnum
CREATE TYPE "WorkActivityType" AS ENUM ('RECEIVING', 'INVENTORY_INTAKE', 'INSPECTION', 'DIAGNOSIS', 'REPAIR', 'TESTING', 'CONFIGURATION', 'PACKAGING', 'LOGISTICS', 'DATA_DESTRUCTION', 'DECOMMISSIONING', 'ADMINISTRATION', 'TRAINING', 'SUPERVISION', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkOrderPartStatus" AS ENUM ('REQUIRED', 'ORDERED', 'BACKORDERED', 'RECEIVED', 'INSTALLED', 'REMOVED', 'RETURNED', 'CONSUMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('PACKAGE_EXTERIOR', 'SHIPPING_LABEL', 'DAMAGE', 'SERIAL_ASSET_TAG', 'BEFORE_REPAIR', 'AFTER_REPAIR', 'TEST_RESULT', 'PACKING', 'OUTBOUND_SHIPMENT', 'SIGNED_AUTHORIZATION', 'TITLE_TRANSFER', 'DATA_DESTRUCTION_CERTIFICATE', 'OTHER');

-- CreateTable
CREATE TABLE "WorkOrderEvent" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus",
    "notes" TEXT,
    "actorLabel" TEXT,
    "systemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkActivity" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workerUserId" TEXT,
    "supervisorUserId" TEXT,
    "workerLabel" TEXT,
    "activityType" "WorkActivityType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "training" BOOLEAN NOT NULL DEFAULT false,
    "supervised" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetObservation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "observerUserId" TEXT,
    "observerLabel" TEXT,
    "observationType" TEXT,
    "condition" "AssetCondition" NOT NULL,
    "notes" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderPart" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "partNumber" TEXT,
    "description" TEXT NOT NULL,
    "manufacturer" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCostCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source" TEXT,
    "status" "WorkOrderPartStatus" NOT NULL DEFAULT 'REQUIRED',
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "returnReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT,
    "workOrderId" TEXT,
    "workOrderEventId" TEXT,
    "packageId" TEXT,
    "receiptId" TEXT,
    "uploaderUserId" TEXT,
    "evidenceType" "EvidenceType" NOT NULL,
    "description" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "storageKey" TEXT,
    "sha256" TEXT,
    "capturedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isOriginal" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderEvent_workOrderId_createdAt_idx" ON "WorkOrderEvent"("workOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkOrderEvent_actorUserId_idx" ON "WorkOrderEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "WorkOrderEvent_eventType_idx" ON "WorkOrderEvent"("eventType");

-- CreateIndex
CREATE INDEX "WorkActivity_workOrderId_startedAt_idx" ON "WorkActivity"("workOrderId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkActivity_workerUserId_idx" ON "WorkActivity"("workerUserId");

-- CreateIndex
CREATE INDEX "WorkActivity_activityType_idx" ON "WorkActivity"("activityType");

-- CreateIndex
CREATE INDEX "AssetObservation_assetId_observedAt_idx" ON "AssetObservation"("assetId", "observedAt");

-- CreateIndex
CREATE INDEX "AssetObservation_workOrderId_idx" ON "AssetObservation"("workOrderId");

-- CreateIndex
CREATE INDEX "AssetObservation_condition_idx" ON "AssetObservation"("condition");

-- CreateIndex
CREATE INDEX "WorkOrderPart_workOrderId_idx" ON "WorkOrderPart"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderPart_status_idx" ON "WorkOrderPart"("status");

-- CreateIndex
CREATE INDEX "WorkOrderPart_partNumber_idx" ON "WorkOrderPart"("partNumber");

-- CreateIndex
CREATE INDEX "Evidence_organizationId_idx" ON "Evidence"("organizationId");

-- CreateIndex
CREATE INDEX "Evidence_assetId_idx" ON "Evidence"("assetId");

-- CreateIndex
CREATE INDEX "Evidence_workOrderId_idx" ON "Evidence"("workOrderId");

-- CreateIndex
CREATE INDEX "Evidence_workOrderEventId_idx" ON "Evidence"("workOrderEventId");

-- CreateIndex
CREATE INDEX "Evidence_packageId_idx" ON "Evidence"("packageId");

-- CreateIndex
CREATE INDEX "Evidence_receiptId_idx" ON "Evidence"("receiptId");

-- CreateIndex
CREATE INDEX "Evidence_evidenceType_idx" ON "Evidence"("evidenceType");

-- AddForeignKey
ALTER TABLE "WorkOrderEvent" ADD CONSTRAINT "WorkOrderEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderEvent" ADD CONSTRAINT "WorkOrderEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkActivity" ADD CONSTRAINT "WorkActivity_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkActivity" ADD CONSTRAINT "WorkActivity_workerUserId_fkey" FOREIGN KEY ("workerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkActivity" ADD CONSTRAINT "WorkActivity_supervisorUserId_fkey" FOREIGN KEY ("supervisorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetObservation" ADD CONSTRAINT "AssetObservation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetObservation" ADD CONSTRAINT "AssetObservation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetObservation" ADD CONSTRAINT "AssetObservation_observerUserId_fkey" FOREIGN KEY ("observerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPart" ADD CONSTRAINT "WorkOrderPart_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_workOrderEventId_fkey" FOREIGN KEY ("workOrderEventId") REFERENCES "WorkOrderEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
