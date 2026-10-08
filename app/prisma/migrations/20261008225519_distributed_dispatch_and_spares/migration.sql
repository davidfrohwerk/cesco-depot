-- CreateEnum
CREATE TYPE "SpareRequisitionStatus" AS ENUM ('OPEN', 'RESERVED', 'DISPATCHED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DispatchAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_TRANSIT', 'COMPLETED', 'EXCEPTION', 'CANCELLED');

-- CreateTable
CREATE TABLE "SpareRequisition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "destinationEndpointId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "assignedAssetId" TEXT,
    "sourceStoragePositionId" TEXT,
    "status" "SpareRequisitionStatus" NOT NULL DEFAULT 'OPEN',
    "manufacturer" TEXT,
    "model" TEXT,
    "compatibilityNotes" TEXT,
    "troubleTicketReference" TEXT,
    "priority" TEXT,
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpareRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "spareRequisitionId" TEXT,
    "assetId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "originEndpointId" TEXT,
    "originStoragePositionId" TEXT,
    "destinationEndpointId" TEXT,
    "destinationStoragePositionId" TEXT,
    "providerCustodyType" "CustodyType" NOT NULL,
    "providerLabel" TEXT NOT NULL,
    "externalReference" TEXT,
    "instructions" TEXT,
    "status" "DispatchAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "exceptionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpareRequisition_organizationId_status_idx" ON "SpareRequisition"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SpareRequisition_destinationEndpointId_idx" ON "SpareRequisition"("destinationEndpointId");

-- CreateIndex
CREATE INDEX "SpareRequisition_assignedAssetId_idx" ON "SpareRequisition"("assignedAssetId");

-- CreateIndex
CREATE INDEX "SpareRequisition_sourceStoragePositionId_idx" ON "SpareRequisition"("sourceStoragePositionId");

-- CreateIndex
CREATE INDEX "SpareRequisition_requestedAt_idx" ON "SpareRequisition"("requestedAt");

-- CreateIndex
CREATE INDEX "DispatchAssignment_organizationId_status_idx" ON "DispatchAssignment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DispatchAssignment_spareRequisitionId_idx" ON "DispatchAssignment"("spareRequisitionId");

-- CreateIndex
CREATE INDEX "DispatchAssignment_assetId_idx" ON "DispatchAssignment"("assetId");

-- CreateIndex
CREATE INDEX "DispatchAssignment_originEndpointId_idx" ON "DispatchAssignment"("originEndpointId");

-- CreateIndex
CREATE INDEX "DispatchAssignment_originStoragePositionId_idx" ON "DispatchAssignment"("originStoragePositionId");

-- CreateIndex
CREATE INDEX "DispatchAssignment_destinationEndpointId_idx" ON "DispatchAssignment"("destinationEndpointId");

-- CreateIndex
CREATE INDEX "DispatchAssignment_destinationStoragePositionId_idx" ON "DispatchAssignment"("destinationStoragePositionId");

-- AddForeignKey
ALTER TABLE "SpareRequisition" ADD CONSTRAINT "SpareRequisition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareRequisition" ADD CONSTRAINT "SpareRequisition_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareRequisition" ADD CONSTRAINT "SpareRequisition_destinationEndpointId_fkey" FOREIGN KEY ("destinationEndpointId") REFERENCES "Endpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareRequisition" ADD CONSTRAINT "SpareRequisition_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareRequisition" ADD CONSTRAINT "SpareRequisition_assignedAssetId_fkey" FOREIGN KEY ("assignedAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareRequisition" ADD CONSTRAINT "SpareRequisition_sourceStoragePositionId_fkey" FOREIGN KEY ("sourceStoragePositionId") REFERENCES "StoragePosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_spareRequisitionId_fkey" FOREIGN KEY ("spareRequisitionId") REFERENCES "SpareRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_originEndpointId_fkey" FOREIGN KEY ("originEndpointId") REFERENCES "Endpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_originStoragePositionId_fkey" FOREIGN KEY ("originStoragePositionId") REFERENCES "StoragePosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_destinationEndpointId_fkey" FOREIGN KEY ("destinationEndpointId") REFERENCES "Endpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_destinationStoragePositionId_fkey" FOREIGN KEY ("destinationStoragePositionId") REFERENCES "StoragePosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
