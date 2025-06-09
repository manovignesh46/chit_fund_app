/*
  Warnings:

  - You are about to drop the column `error` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `paidDate` on the `Repayment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentType` on the `Repayment` table. All the data in the column will be lost.
  - You are about to drop the column `period` on the `Repayment` table. All the data in the column will be lost.
  - You are about to drop the `ChitFundMember` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[chitFundId,month]` on the table `ChitFundFixedAmount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[emailType,period]` on the table `EmailLog` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `winnerId` to the `Auction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period` to the `EmailLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `collected_by_id` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entered_by_id` to the `Repayment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ChitFundMember" DROP CONSTRAINT "ChitFundMember_chitFundId_fkey";

-- DropForeignKey
ALTER TABLE "ChitFundMember" DROP CONSTRAINT "ChitFundMember_globalMemberId_fkey";

-- DropForeignKey
ALTER TABLE "Contribution" DROP CONSTRAINT "Contribution_memberId_fkey";

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "highestBid" DOUBLE PRECISION,
ADD COLUMN     "lowestBid" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "numberOfBidders" INTEGER,
ADD COLUMN     "winnerId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Contribution" ALTER COLUMN "balance" SET DEFAULT 0,
ALTER COLUMN "balancePaymentStatus" SET DEFAULT 'Pending';

-- AlterTable
ALTER TABLE "EmailLog" DROP COLUMN "error",
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "isRecovery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "period" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'sent';

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "currentMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "missedPayments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overdueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "documentCharge" SET DEFAULT 0,
ALTER COLUMN "installmentAmount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Repayment" DROP COLUMN "paidDate",
DROP COLUMN "paymentType",
DROP COLUMN "period",
ADD COLUMN     "collected_by_id" INTEGER NOT NULL,
ADD COLUMN     "createdById" INTEGER NOT NULL,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "entered_by_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "ChitFundMember";

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "globalMemberId" INTEGER NOT NULL,
    "chitFundId" INTEGER NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auctionWon" BOOLEAN NOT NULL DEFAULT false,
    "auctionMonth" INTEGER,
    "contribution" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSchedule" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "actualPaymentDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "from_partner_id" INTEGER,
    "to_partner_id" INTEGER,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Member_chitFundId_idx" ON "Member"("chitFundId");

-- CreateIndex
CREATE INDEX "Member_globalMemberId_idx" ON "Member"("globalMemberId");

-- CreateIndex
CREATE INDEX "PaymentSchedule_loanId_idx" ON "PaymentSchedule"("loanId");

-- CreateIndex
CREATE INDEX "Partner_createdById_idx" ON "Partner"("createdById");

-- CreateIndex
CREATE INDEX "Transaction_createdById_idx" ON "Transaction"("createdById");

-- CreateIndex
CREATE INDEX "Transaction_from_partner_id_idx" ON "Transaction"("from_partner_id");

-- CreateIndex
CREATE INDEX "Transaction_to_partner_id_idx" ON "Transaction"("to_partner_id");

-- CreateIndex
CREATE INDEX "Auction_chitFundId_idx" ON "Auction"("chitFundId");

-- CreateIndex
CREATE INDEX "Auction_winnerId_idx" ON "Auction"("winnerId");

-- CreateIndex
CREATE INDEX "ChitFundFixedAmount_chitFundId_idx" ON "ChitFundFixedAmount"("chitFundId");

-- CreateIndex
CREATE UNIQUE INDEX "ChitFundFixedAmount_chitFundId_month_key" ON "ChitFundFixedAmount"("chitFundId", "month");

-- CreateIndex
CREATE INDEX "Contribution_chitFundId_idx" ON "Contribution"("chitFundId");

-- CreateIndex
CREATE INDEX "Contribution_memberId_idx" ON "Contribution"("memberId");

-- CreateIndex
CREATE INDEX "EmailLog_emailType_sentDate_idx" ON "EmailLog"("emailType", "sentDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_emailType_period_key" ON "EmailLog"("emailType", "period");

-- CreateIndex
CREATE INDEX "GlobalMember_createdById_idx" ON "GlobalMember"("createdById");

-- CreateIndex
CREATE INDEX "Loan_borrowerId_idx" ON "Loan"("borrowerId");

-- CreateIndex
CREATE INDEX "Loan_createdById_idx" ON "Loan"("createdById");

-- CreateIndex
CREATE INDEX "Repayment_createdById_idx" ON "Repayment"("createdById");

-- CreateIndex
CREATE INDEX "Repayment_loanId_idx" ON "Repayment"("loanId");

-- CreateIndex
CREATE INDEX "Repayment_collected_by_id_idx" ON "Repayment"("collected_by_id");

-- CreateIndex
CREATE INDEX "Repayment_entered_by_id_idx" ON "Repayment"("entered_by_id");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES "ChitFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_globalMemberId_fkey" FOREIGN KEY ("globalMemberId") REFERENCES "GlobalMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_from_partner_id_fkey" FOREIGN KEY ("from_partner_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_to_partner_id_fkey" FOREIGN KEY ("to_partner_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
