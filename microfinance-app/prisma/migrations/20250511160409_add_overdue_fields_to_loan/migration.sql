-- RedefineTables
PRAGMA foreign_keys=OFF;
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
    "overdueAmount" REAL NOT NULL DEFAULT 0,
    "missedPayments" INTEGER NOT NULL DEFAULT 0,
    "nextPaymentDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "purpose" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" INTEGER NOT NULL,
    CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "GlobalMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Loan" ("amount", "borrowerId", "createdAt", "createdById", "currentMonth", "disbursementDate", "documentCharge", "duration", "id", "installmentAmount", "interestRate", "loanType", "nextPaymentDate", "purpose", "remainingAmount", "repaymentType", "status", "updatedAt") SELECT "amount", "borrowerId", "createdAt", "createdById", "currentMonth", "disbursementDate", "documentCharge", "duration", "id", "installmentAmount", "interestRate", "loanType", "nextPaymentDate", "purpose", "remainingAmount", "repaymentType", "status", "updatedAt" FROM "Loan";
DROP TABLE "Loan";
ALTER TABLE "new_Loan" RENAME TO "Loan";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
