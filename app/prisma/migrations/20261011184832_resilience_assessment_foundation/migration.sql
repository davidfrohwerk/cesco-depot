-- CreateEnum
CREATE TYPE "ReliabilityMetricType" AS ENUM ('FIELD_AFR', 'FAILURE_RATE', 'MTBF', 'MTTF', 'FAILURE_PROBABILITY', 'LIFECYCLE_INTERVAL', 'DUTY_CYCLE_LIMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReliabilityEvidenceType" AS ENUM ('PUBLIC_FIELD', 'OEM_FIELD', 'OEM_PREDICTED', 'GOVERNMENT_REFERENCE', 'COMMERCIAL_SURROGATE', 'RESEARCH_SURROGATE', 'PLANNING_ASSUMPTION');

-- CreateEnum
CREATE TYPE "ReliabilitySpecificity" AS ENUM ('EXACT_MODEL', 'MODEL_FAMILY', 'ASSEMBLY_CLASS', 'COMPONENT_CLASS', 'EQUIPMENT_CLASS');

-- CreateEnum
CREATE TYPE "ReliabilityConfidence" AS ENUM ('HIGH', 'MODERATE', 'LOW', 'INSUFFICIENT');

-- CreateEnum
CREATE TYPE "InfrastructureAssessmentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'COMPLETED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssessmentScenarioKind" AS ENUM ('LOW', 'PLANNING', 'STRESS');

-- CreateTable
CREATE TABLE "ReliabilityEvidence" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "modelFamily" TEXT,
    "assetClass" TEXT,
    "metricType" "ReliabilityMetricType" NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "evidenceType" "ReliabilityEvidenceType" NOT NULL,
    "specificity" "ReliabilitySpecificity" NOT NULL,
    "confidence" "ReliabilityConfidence" NOT NULL,
    "publisher" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceIdentifier" TEXT,
    "sourcePublishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "methodology" TEXT,
    "observed" BOOLEAN NOT NULL DEFAULT false,
    "populationSize" INTEGER,
    "exposureValue" DOUBLE PRECISION,
    "exposureUnit" TEXT,
    "failureCount" INTEGER,
    "operatingEnvironment" TEXT,
    "temperatureC" DOUBLE PRECISION,
    "dutyCycleNotes" TEXT,
    "applicabilityNotes" TEXT,
    "limitations" TEXT,
    "licenseNotes" TEXT,
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReliabilityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InfrastructureAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceImportJobId" TEXT,
    "rulesetVersion" TEXT NOT NULL DEFAULT '1',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureAssessmentPopulation" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "modelFamily" TEXT,
    "assetClass" TEXT,
    "compatibilityClass" TEXT,
    "populationLabel" TEXT NOT NULL,
    "assetCount" INTEGER NOT NULL,
    "missionCritical" BOOLEAN,
    "criticalityNotes" TEXT,
    "rtoHours" DOUBLE PRECISION,
    "localRedundancy" BOOLEAN,
    "redundancyNotes" TEXT,
    "procurementLeadDays" DOUBLE PRECISION,
    "repairTurnaroundDays" DOUBLE PRECISION,
    "fieldReplacementHours" DOUBLE PRECISION,
    "configurationHours" DOUBLE PRECISION,
    "substitutable" BOOLEAN,
    "substituteNotes" TEXT,
    "exposureModel" TEXT,
    "exposureInputs" JSONB,
    "customerInputNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureAssessmentPopulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureAssessmentPopulationAsset" (
    "populationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "includedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfrastructureAssessmentPopulationAsset_pkey" PRIMARY KEY ("populationId","assetId")
);

-- CreateTable
CREATE TABLE "InfrastructureAssessmentEvidence" (
    "id" TEXT NOT NULL,
    "populationId" TEXT NOT NULL,
    "reliabilityEvidenceId" TEXT NOT NULL,
    "selectedForPlanning" BOOLEAN NOT NULL DEFAULT false,
    "applicabilityNotes" TEXT,
    "transformation" TEXT,
    "derivedMetricValue" DOUBLE PRECISION,
    "derivedMetricUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfrastructureAssessmentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureAssessmentScenario" (
    "id" TEXT NOT NULL,
    "populationId" TEXT NOT NULL,
    "kind" "AssessmentScenarioKind" NOT NULL,
    "annualFailureProbability" DOUBLE PRECISION,
    "failureRateSource" TEXT,
    "exposureWindowDays" DOUBLE PRECISION,
    "targetServiceLevel" DOUBLE PRECISION,
    "expectedDemand" DOUBLE PRECISION,
    "recommendedSpareCount" INTEGER,
    "repairPipelineReserve" INTEGER,
    "contingencyReserve" INTEGER,
    "totalRecommendedSpareCount" INTEGER,
    "method" TEXT NOT NULL DEFAULT 'POISSON',
    "confidence" "ReliabilityConfidence" NOT NULL,
    "assumptions" JSONB,
    "limitations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureAssessmentScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReliabilityEvidence_manufacturer_model_idx" ON "ReliabilityEvidence"("manufacturer", "model");

-- CreateIndex
CREATE INDEX "ReliabilityEvidence_assetClass_idx" ON "ReliabilityEvidence"("assetClass");

-- CreateIndex
CREATE INDEX "ReliabilityEvidence_evidenceType_idx" ON "ReliabilityEvidence"("evidenceType");

-- CreateIndex
CREATE INDEX "ReliabilityEvidence_specificity_idx" ON "ReliabilityEvidence"("specificity");

-- CreateIndex
CREATE INDEX "ReliabilityEvidence_publisher_idx" ON "ReliabilityEvidence"("publisher");

-- CreateIndex
CREATE INDEX "InfrastructureAssessment_organizationId_idx" ON "InfrastructureAssessment"("organizationId");

-- CreateIndex
CREATE INDEX "InfrastructureAssessment_createdByUserId_idx" ON "InfrastructureAssessment"("createdByUserId");

-- CreateIndex
CREATE INDEX "InfrastructureAssessment_sourceImportJobId_idx" ON "InfrastructureAssessment"("sourceImportJobId");

-- CreateIndex
CREATE INDEX "InfrastructureAssessment_status_idx" ON "InfrastructureAssessment"("status");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentPopulation_assessmentId_idx" ON "InfrastructureAssessmentPopulation"("assessmentId");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentPopulation_manufacturer_model_idx" ON "InfrastructureAssessmentPopulation"("manufacturer", "model");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentPopulation_assetClass_idx" ON "InfrastructureAssessmentPopulation"("assetClass");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentPopulation_compatibilityClass_idx" ON "InfrastructureAssessmentPopulation"("compatibilityClass");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentPopulationAsset_assetId_idx" ON "InfrastructureAssessmentPopulationAsset"("assetId");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentEvidence_populationId_idx" ON "InfrastructureAssessmentEvidence"("populationId");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentEvidence_reliabilityEvidenceId_idx" ON "InfrastructureAssessmentEvidence"("reliabilityEvidenceId");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentEvidence_selectedForPlanning_idx" ON "InfrastructureAssessmentEvidence"("selectedForPlanning");

-- CreateIndex
CREATE UNIQUE INDEX "InfrastructureAssessmentEvidence_populationId_reliabilityEv_key" ON "InfrastructureAssessmentEvidence"("populationId", "reliabilityEvidenceId");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentScenario_populationId_idx" ON "InfrastructureAssessmentScenario"("populationId");

-- CreateIndex
CREATE INDEX "InfrastructureAssessmentScenario_kind_idx" ON "InfrastructureAssessmentScenario"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "InfrastructureAssessmentScenario_populationId_kind_key" ON "InfrastructureAssessmentScenario"("populationId", "kind");

-- AddForeignKey
ALTER TABLE "ReliabilityEvidence" ADD CONSTRAINT "ReliabilityEvidence_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureAssessment" ADD CONSTRAINT "InfrastructureAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureAssessment" ADD CONSTRAINT "InfrastructureAssessment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureAssessment" ADD CONSTRAINT "InfrastructureAssessment_sourceImportJobId_fkey" FOREIGN KEY ("sourceImportJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureAssessmentPopulation" ADD CONSTRAINT "InfrastructureAssessmentPopulation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "InfrastructureAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureAssessmentPopulationAsset" ADD CONSTRAINT "InfrastructureAssessmentPopulationAsset_populationId_fkey" FOREIGN KEY ("populationId") REFERENCES "InfrastructureAssessmentPopulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureAssessmentPopulationAsset" ADD CONSTRAINT "InfrastructureAssessmentPopulationAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureAssessmentEvidence" ADD CONSTRAINT "InfrastructureAssessmentEvidence_populationId_fkey" FOREIGN KEY ("populationId") REFERENCES "InfrastructureAssessmentPopulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureAssessmentEvidence" ADD CONSTRAINT "InfrastructureAssessmentEvidence_reliabilityEvidenceId_fkey" FOREIGN KEY ("reliabilityEvidenceId") REFERENCES "ReliabilityEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureAssessmentScenario" ADD CONSTRAINT "InfrastructureAssessmentScenario_populationId_fkey" FOREIGN KEY ("populationId") REFERENCES "InfrastructureAssessmentPopulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
