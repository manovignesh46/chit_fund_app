-- CreateTable
CREATE TABLE "ChitFundTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "monthlyContribution" DOUBLE PRECISION NOT NULL,
    "firstMonthContribution" DOUBLE PRECISION,
    "duration" INTEGER NOT NULL,
    "membersCount" INTEGER NOT NULL,
    "chitFundType" TEXT NOT NULL DEFAULT 'Auction',
    "fixedAmountsPattern" JSONB,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChitFundTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChitFundTemplate_createdById_idx" ON "ChitFundTemplate"("createdById");

-- AlterTable (additive, nullable — no lock risk on existing rows)
ALTER TABLE "ChitFund" ADD COLUMN "templateId" INTEGER;

-- CreateIndex
CREATE INDEX "ChitFund_templateId_idx" ON "ChitFund"("templateId");

-- AddForeignKey
ALTER TABLE "ChitFundTemplate" ADD CONSTRAINT "ChitFundTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChitFund" ADD CONSTRAINT "ChitFund_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChitFundTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
