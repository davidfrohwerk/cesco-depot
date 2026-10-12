-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('INTERNAL', 'CLIENT');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "kind" "OrganizationKind" NOT NULL DEFAULT 'CLIENT';
