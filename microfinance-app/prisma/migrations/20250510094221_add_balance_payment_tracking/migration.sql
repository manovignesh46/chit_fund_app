-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN "actualBalancePaymentDate" DATETIME;
ALTER TABLE "Contribution" ADD COLUMN "balancePaymentStatus" TEXT DEFAULT 'Pending';
