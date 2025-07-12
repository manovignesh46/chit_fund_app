/*
  Warnings:

  - A unique constraint covering the columns `[partnerId,month,year]` on the table `PartnerMonthlySummary` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `year` to the `PartnerMonthlySummary` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `month` on the `PartnerMonthlySummary` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "PartnerMonthlySummary_partnerId_month_key";

-- AlterTable
ALTER TABLE "PartnerMonthlySummary" ADD COLUMN     "year" INTEGER NOT NULL,
DROP COLUMN "month",
ADD COLUMN     "month" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMonthlySummary_partnerId_month_year_key" ON "PartnerMonthlySummary"("partnerId", "month", "year");
