-- CreateEnum
CREATE TYPE "EndpointType" AS ENUM ('STORE', 'CLINIC', 'BRANCH', 'RESTAURANT', 'WAREHOUSE', 'OFFICE', 'DATA_CENTER', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceLocationType" AS ENUM ('DEPOT', 'STORAGE_UNIT', 'WAREHOUSE', 'PARTNER_FACILITY', 'CROSS_DOCK', 'TECHNICIAN_STAGING', 'OTHER');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "currentEndpointId" TEXT,
ADD COLUMN     "currentStoragePositionId" TEXT;

-- CreateTable
CREATE TABLE "Endpoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalCode" TEXT,
    "name" TEXT NOT NULL,
    "type" "EndpointType" NOT NULL DEFAULT 'OTHER',
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "region" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "serviceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLocation" (
    "id" TEXT NOT NULL,
    "managedByOrganizationId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" "ServiceLocationType" NOT NULL,
    "operatorLabel" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "region" TEXT,
    "climateControlled" BOOLEAN NOT NULL DEFAULT false,
    "secureStorage" BOOLEAN NOT NULL DEFAULT false,
    "custodyType" "CustodyType" NOT NULL DEFAULT 'CESCO',
    "custodianLabel" TEXT,
    "accessInstructions" TEXT,
    "capabilities" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLocationClient" (
    "serviceLocationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLocationClient_pkey" PRIMARY KEY ("serviceLocationId","organizationId")
);

-- CreateTable
CREATE TABLE "StoragePosition" (
    "id" TEXT NOT NULL,
    "serviceLocationId" TEXT NOT NULL,
    "parentId" TEXT,
    "dedicatedOrganizationId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "StorageLocationType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER,
    "capacityUnit" TEXT,
    "secureStorage" BOOLEAN NOT NULL DEFAULT false,
    "environmentalNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoragePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMovement" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "fromEndpointId" TEXT,
    "toEndpointId" TEXT,
    "fromStoragePositionId" TEXT,
    "toStoragePositionId" TEXT,
    "fromCustodyType" "CustodyType",
    "toCustodyType" "CustodyType",
    "fromCustodianLabel" TEXT,
    "toCustodianLabel" TEXT,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Endpoint_organizationId_idx" ON "Endpoint"("organizationId");

-- CreateIndex
CREATE INDEX "Endpoint_isActive_idx" ON "Endpoint"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_organizationId_externalCode_key" ON "Endpoint"("organizationId", "externalCode");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLocation_code_key" ON "ServiceLocation"("code");

-- CreateIndex
CREATE INDEX "ServiceLocation_managedByOrganizationId_idx" ON "ServiceLocation"("managedByOrganizationId");

-- CreateIndex
CREATE INDEX "ServiceLocation_type_idx" ON "ServiceLocation"("type");

-- CreateIndex
CREATE INDEX "ServiceLocation_isActive_idx" ON "ServiceLocation"("isActive");

-- CreateIndex
CREATE INDEX "ServiceLocationClient_organizationId_idx" ON "ServiceLocationClient"("organizationId");

-- CreateIndex
CREATE INDEX "StoragePosition_serviceLocationId_idx" ON "StoragePosition"("serviceLocationId");

-- CreateIndex
CREATE INDEX "StoragePosition_parentId_idx" ON "StoragePosition"("parentId");

-- CreateIndex
CREATE INDEX "StoragePosition_dedicatedOrganizationId_idx" ON "StoragePosition"("dedicatedOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "StoragePosition_serviceLocationId_code_key" ON "StoragePosition"("serviceLocationId", "code");

-- CreateIndex
CREATE INDEX "AssetMovement_assetId_occurredAt_idx" ON "AssetMovement"("assetId", "occurredAt");

-- CreateIndex
CREATE INDEX "AssetMovement_actorUserId_idx" ON "AssetMovement"("actorUserId");

-- CreateIndex
CREATE INDEX "AssetMovement_fromEndpointId_idx" ON "AssetMovement"("fromEndpointId");

-- CreateIndex
CREATE INDEX "AssetMovement_toEndpointId_idx" ON "AssetMovement"("toEndpointId");

-- CreateIndex
CREATE INDEX "AssetMovement_fromStoragePositionId_idx" ON "AssetMovement"("fromStoragePositionId");

-- CreateIndex
CREATE INDEX "AssetMovement_toStoragePositionId_idx" ON "AssetMovement"("toStoragePositionId");

-- CreateIndex
CREATE INDEX "Asset_currentEndpointId_idx" ON "Asset"("currentEndpointId");

-- CreateIndex
CREATE INDEX "Asset_currentStoragePositionId_idx" ON "Asset"("currentStoragePositionId");

-- AddForeignKey
ALTER TABLE "Endpoint" ADD CONSTRAINT "Endpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLocation" ADD CONSTRAINT "ServiceLocation_managedByOrganizationId_fkey" FOREIGN KEY ("managedByOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLocationClient" ADD CONSTRAINT "ServiceLocationClient_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLocationClient" ADD CONSTRAINT "ServiceLocationClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoragePosition" ADD CONSTRAINT "StoragePosition_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoragePosition" ADD CONSTRAINT "StoragePosition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StoragePosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoragePosition" ADD CONSTRAINT "StoragePosition_dedicatedOrganizationId_fkey" FOREIGN KEY ("dedicatedOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_currentEndpointId_fkey" FOREIGN KEY ("currentEndpointId") REFERENCES "Endpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_currentStoragePositionId_fkey" FOREIGN KEY ("currentStoragePositionId") REFERENCES "StoragePosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_fromEndpointId_fkey" FOREIGN KEY ("fromEndpointId") REFERENCES "Endpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_toEndpointId_fkey" FOREIGN KEY ("toEndpointId") REFERENCES "Endpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_fromStoragePositionId_fkey" FOREIGN KEY ("fromStoragePositionId") REFERENCES "StoragePosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_toStoragePositionId_fkey" FOREIGN KEY ("toStoragePositionId") REFERENCES "StoragePosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
