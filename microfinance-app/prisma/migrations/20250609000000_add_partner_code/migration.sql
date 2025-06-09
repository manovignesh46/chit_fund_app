-- AlterTable
ALTER TABLE "Partner" ADD COLUMN "code" TEXT;

-- Add a unique constraint for code per user
CREATE UNIQUE INDEX "Partner_createdById_code_key" ON "Partner"("createdById", "code") WHERE "code" IS NOT NULL;
