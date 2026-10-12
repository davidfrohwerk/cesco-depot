/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,externalId]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ImportEntityType" AS ENUM ('ENDPOINT', 'ASSET');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('VALIDATING', 'READY', 'VALIDATION_FAILED', 'COMMITTING', 'COMPLETED', 'COMMIT_FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportDuplicatePolicy" AS ENUM ('CREATE_ONLY', 'UPDATE_MATCHED', 'SKIP_EXISTING');

-- CreateEnum
CREATE TYPE "ImportRowAction" AS ENUM ('CREATE', 'UPDATE', 'SKIP', 'ERROR');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "entityType" "ImportEntityType" NOT NULL,
    "sourceFormat" TEXT NOT NULL DEFAULT 'CSV',
    "originalFilename" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'VALIDATING',
    "duplicatePolicy" "ImportDuplicatePolicy" NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "createCount" INTEGER NOT NULL DEFAULT 0,
    "updateCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB NOT NULL,
    "action" "ImportRowAction" NOT NULL,
    "matchedRecordId" TEXT,
    "validationErrors" JSONB,
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportJob_organizationId_submittedAt_idx" ON "ImportJob"("organizationId", "submittedAt");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportRow_importJobId_action_idx" ON "ImportRow"("importJobId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_importJobId_rowNumber_key" ON "ImportRow"("importJobId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_organizationId_externalId_key" ON "Asset"("organizationId", "externalId");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
