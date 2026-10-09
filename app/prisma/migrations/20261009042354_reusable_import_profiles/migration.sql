-- CreateTable
CREATE TABLE "ImportProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" "ImportEntityType" NOT NULL,
    "duplicatePolicy" "ImportDuplicatePolicy" NOT NULL DEFAULT 'CREATE_ONLY',
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportProfile_organizationId_entityType_idx" ON "ImportProfile"("organizationId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "ImportProfile_organizationId_entityType_name_key" ON "ImportProfile"("organizationId", "entityType", "name");

-- AddForeignKey
ALTER TABLE "ImportProfile" ADD CONSTRAINT "ImportProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportProfile" ADD CONSTRAINT "ImportProfile_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
