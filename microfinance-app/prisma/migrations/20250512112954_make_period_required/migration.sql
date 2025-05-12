/*
  Warnings:

  - Made the column `period` on table `Repayment` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Repayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" REAL NOT NULL,
    "paidDate" DATETIME NOT NULL,
    "loanId" INTEGER NOT NULL,
    "paymentType" TEXT NOT NULL DEFAULT 'full',
    "period" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Repayment" ("amount", "createdAt", "id", "loanId", "paidDate", "paymentType", "period", "updatedAt") SELECT "amount", "createdAt", "id", "loanId", "paidDate", coalesce("paymentType", 'full') AS "paymentType", "period", "updatedAt" FROM "Repayment";
DROP TABLE "Repayment";
ALTER TABLE "new_Repayment" RENAME TO "Repayment";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
