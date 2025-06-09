/*
  Warnings:

  - Added the required column `paidDate` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentType` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period` to the `Repayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Repayment" ADD COLUMN     "paidDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "paymentType" TEXT NOT NULL,
ADD COLUMN     "period" INTEGER NOT NULL;
