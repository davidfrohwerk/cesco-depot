-- CreateTable
CREATE TABLE "EvidenceAccessEvent" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'DOWNLOAD',
    "integrityVerified" BOOLEAN NOT NULL DEFAULT true,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceAccessEvent_evidenceId_accessedAt_idx" ON "EvidenceAccessEvent"("evidenceId", "accessedAt");

-- CreateIndex
CREATE INDEX "EvidenceAccessEvent_actorUserId_accessedAt_idx" ON "EvidenceAccessEvent"("actorUserId", "accessedAt");

-- CreateIndex
CREATE INDEX "EvidenceAccessEvent_action_idx" ON "EvidenceAccessEvent"("action");

-- AddForeignKey
ALTER TABLE "EvidenceAccessEvent" ADD CONSTRAINT "EvidenceAccessEvent_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAccessEvent" ADD CONSTRAINT "EvidenceAccessEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
