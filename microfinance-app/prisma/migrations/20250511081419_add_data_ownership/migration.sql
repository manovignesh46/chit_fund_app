-- First, make sure we have at least one admin user
-- If no admin user exists, create one
INSERT INTO "User" ("name", "email", "password", "role", "createdAt", "updatedAt")
SELECT 'Admin User', 'amfincorp1@gmail.com', '$2b$10$hyMlD43G.FZnqirtvqkSU.VQNJrhPhLwaHm6abzfI0LqjyI6jTTNi', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'amfincorp1@gmail.com');
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GlobalMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" INTEGER NOT NULL,
    CONSTRAINT "GlobalMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GlobalMember" ("address", "contact", "createdAt", "email", "id", "name", "notes", "updatedAt", "createdById")
SELECT "address", "contact", "createdAt", "email", "id", "name", "notes", "updatedAt",
(SELECT "id" FROM "User" WHERE "role" = 'admin' LIMIT 1) FROM "GlobalMember";
DROP TABLE "GlobalMember";
ALTER TABLE "new_GlobalMember" RENAME TO "GlobalMember";
CREATE TABLE "new_ChitFund" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "monthlyContribution" REAL NOT NULL,
    "duration" INTEGER NOT NULL,
    "membersCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "startDate" DATETIME NOT NULL,
    "currentMonth" INTEGER NOT NULL DEFAULT 1,
    "nextAuctionDate" DATETIME,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" INTEGER NOT NULL,
    CONSTRAINT "ChitFund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ChitFund" ("createdAt", "currentMonth", "description", "duration", "id", "membersCount", "monthlyContribution", "name", "nextAuctionDate", "startDate", "status", "totalAmount", "updatedAt", "createdById")
SELECT "createdAt", "currentMonth", "description", "duration", "id", "membersCount", "monthlyContribution", "name", "nextAuctionDate", "startDate", "status", "totalAmount", "updatedAt",
(SELECT "id" FROM "User" WHERE "role" = 'admin' LIMIT 1) FROM "ChitFund";
DROP TABLE "ChitFund";
ALTER TABLE "new_ChitFund" RENAME TO "ChitFund";
CREATE TABLE "new_Loan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "borrowerId" INTEGER NOT NULL,
    "loanType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "interestRate" REAL NOT NULL,
    "documentCharge" REAL NOT NULL DEFAULT 0,
    "currentMonth" INTEGER NOT NULL DEFAULT 0,
    "installmentAmount" REAL NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL,
    "disbursementDate" DATETIME NOT NULL,
    "repaymentType" TEXT NOT NULL,
    "remainingAmount" REAL NOT NULL,
    "nextPaymentDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "purpose" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" INTEGER NOT NULL,
    CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "GlobalMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Loan" ("amount", "borrowerId", "createdAt", "currentMonth", "disbursementDate", "documentCharge", "duration", "id", "installmentAmount", "interestRate", "loanType", "nextPaymentDate", "purpose", "remainingAmount", "repaymentType", "status", "updatedAt", "createdById")
SELECT "amount", "borrowerId", "createdAt", "currentMonth", "disbursementDate", "documentCharge", "duration", "id", "installmentAmount", "interestRate", "loanType", "nextPaymentDate", "purpose", "remainingAmount", "repaymentType", "status", "updatedAt",
(SELECT "id" FROM "User" WHERE "role" = 'admin' LIMIT 1) FROM "Loan";
DROP TABLE "Loan";
ALTER TABLE "new_Loan" RENAME TO "Loan";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
