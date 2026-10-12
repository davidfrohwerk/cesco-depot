-- Additive commercial foundation; do not execute against live data without backup and validation.
CREATE TYPE "ServiceAgreementStatus" AS ENUM ('DRAFT','ACTIVE','SUSPENDED','EXPIRED','TERMINATED');
CREATE TYPE "CommercialRateUnit" AS ENUM ('EACH','PER_ASSET_DAY','PER_ASSET_MONTH','PER_HOUR','FLAT');
CREATE TYPE "CommercialChargeStatus" AS ENUM ('DRAFT','APPROVED','EXPORTED','VOIDED');

CREATE TABLE "ServiceAgreement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agreementCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "ServiceAgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceAgreement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceAgreement_organizationId_agreementCode_key" ON "ServiceAgreement"("organizationId","agreementCode");
CREATE INDEX "ServiceAgreement_organizationId_status_idx" ON "ServiceAgreement"("organizationId","status");
ALTER TABLE "ServiceAgreement" ADD CONSTRAINT "ServiceAgreement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CommercialRate" (
  "id" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "unit" "CommercialRateUnit" NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommercialRate_agreementId_serviceCode_effectiveFrom_idx" ON "CommercialRate"("agreementId","serviceCode","effectiveFrom");
ALTER TABLE "CommercialRate" ADD CONSTRAINT "CommercialRate_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "ServiceAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CommercialCharge" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "rateId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "serviceFrom" TIMESTAMP(3) NOT NULL,
  "serviceTo" TIMESTAMP(3),
  "status" "CommercialChargeStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "exportedAt" TIMESTAMP(3),
  "invoiceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialCharge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommercialCharge_organizationId_idempotencyKey_key" ON "CommercialCharge"("organizationId","idempotencyKey");
CREATE INDEX "CommercialCharge_organizationId_status_serviceFrom_idx" ON "CommercialCharge"("organizationId","status","serviceFrom");
CREATE INDEX "CommercialCharge_agreementId_serviceFrom_idx" ON "CommercialCharge"("agreementId","serviceFrom");
CREATE INDEX "CommercialCharge_sourceType_sourceId_idx" ON "CommercialCharge"("sourceType","sourceId");
ALTER TABLE "CommercialCharge" ADD CONSTRAINT "CommercialCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCharge" ADD CONSTRAINT "CommercialCharge_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "ServiceAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCharge" ADD CONSTRAINT "CommercialCharge_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "CommercialRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
