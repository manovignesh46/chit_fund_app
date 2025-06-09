/*
  Warnings:

  - Changed the type of `paymentType` on the `Repayment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "RepaymentType" AS ENUM ('REGULAR', 'INTEREST_ONLY', 'PARTIAL');

-- DropForeignKey
ALTER TABLE "Repayment" DROP CONSTRAINT "Repayment_loanId_fkey";

-- AlterTable
ALTER TABLE "Repayment" DROP COLUMN "paymentType",
ADD COLUMN     "paymentType" "RepaymentType" NOT NULL;

-- CreateIndex
CREATE INDEX "Repayment_paidDate_idx" ON "Repayment"("paidDate");

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
