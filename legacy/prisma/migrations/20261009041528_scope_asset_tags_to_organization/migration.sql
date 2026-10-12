/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,assetTag]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Asset_assetTag_key";

-- CreateIndex
CREATE UNIQUE INDEX "Asset_organizationId_assetTag_key" ON "Asset"("organizationId", "assetTag");
