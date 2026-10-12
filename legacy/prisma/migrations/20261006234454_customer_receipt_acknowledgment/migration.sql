-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "customerAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "customerAcknowledgedByLabel" TEXT,
ADD COLUMN     "customerAcknowledgmentNotes" TEXT;
