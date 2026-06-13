-- AlterTable: nullable columns only — safe for existing production data
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "partnerId" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dataOwnerId" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_partnerId_idx" ON "User"("partnerId");
CREATE INDEX IF NOT EXISTS "User_dataOwnerId_idx" ON "User"("dataOwnerId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_dataOwnerId_fkey" FOREIGN KEY ("dataOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
