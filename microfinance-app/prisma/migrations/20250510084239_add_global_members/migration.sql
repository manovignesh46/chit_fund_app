/*
  Warnings:

  - You are about to drop the column `contact` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `borrowerName` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the column `contact` on the `Loan` table. All the data in the column will be lost.
  - Added the required column `globalMemberId` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `borrowerId` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "GlobalMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create global members from existing members
INSERT INTO "GlobalMember" ("id", "name", "contact", "createdAt", "updatedAt")
SELECT "id", "name", "contact", "createdAt", "updatedAt" FROM "Member";

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "globalMemberId" INTEGER NOT NULL,
    "chitFundId" INTEGER NOT NULL,
    "joinDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auctionWon" BOOLEAN NOT NULL DEFAULT false,
    "auctionMonth" INTEGER,
    "contribution" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES "ChitFund" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Member_globalMemberId_fkey" FOREIGN KEY ("globalMemberId") REFERENCES "GlobalMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("auctionMonth", "auctionWon", "chitFundId", "contribution", "createdAt", "id", "joinDate", "updatedAt", "globalMemberId")
SELECT "auctionMonth", "auctionWon", "chitFundId", "contribution", "createdAt", "id", "joinDate", "updatedAt", "id" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
-- Create global members from existing loan borrowers
INSERT INTO "GlobalMember" ("id", "name", "contact", "createdAt", "updatedAt")
SELECT l.id + 100, l.borrowerName, l.contact, l.createdAt, l.updatedAt
FROM "Loan" l
WHERE NOT EXISTS (
    SELECT 1 FROM "GlobalMember" gm
    WHERE gm.name = l.borrowerName AND gm.contact = l.contact
);

CREATE TABLE "new_Loan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "borrowerId" INTEGER NOT NULL,
    "loanType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "interestRate" REAL NOT NULL,
    "duration" INTEGER NOT NULL,
    "disbursementDate" DATETIME NOT NULL,
    "repaymentType" TEXT NOT NULL,
    "remainingAmount" REAL NOT NULL,
    "nextPaymentDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "purpose" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "GlobalMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Loan" ("amount", "createdAt", "disbursementDate", "duration", "id", "interestRate", "loanType", "nextPaymentDate", "purpose", "remainingAmount", "repaymentType", "status", "updatedAt", "borrowerId")
SELECT "amount", "createdAt", "disbursementDate", "duration", "id", "interestRate", "loanType", "nextPaymentDate", "purpose", "remainingAmount", "repaymentType", "status", "updatedAt", (id + 100) FROM "Loan";
DROP TABLE "Loan";
ALTER TABLE "new_Loan" RENAME TO "Loan";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
