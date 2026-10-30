-- AlterTable: link notifications to the record they describe
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "entityId" INTEGER;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "details" JSONB;
