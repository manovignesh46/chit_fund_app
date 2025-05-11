-- Drop the PaymentSchedule table and its relations
PRAGMA foreign_keys=OFF;

-- First, update the Repayment table to remove the reference to PaymentSchedule
CREATE TABLE "new_Repayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" REAL NOT NULL,
    "paidDate" DATETIME NOT NULL,
    "loanId" INTEGER NOT NULL,
    "paymentType" TEXT DEFAULT 'full',
    "period" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Copy data from the old Repayment table to the new one
INSERT INTO "new_Repayment" ("id", "amount", "paidDate", "loanId", "paymentType", "createdAt", "updatedAt")
SELECT "id", "amount", "paidDate", "loanId", "paymentType", "createdAt", "updatedAt" FROM "Repayment";

-- Drop the old Repayment table
DROP TABLE "Repayment";

-- Rename the new Repayment table
ALTER TABLE "new_Repayment" RENAME TO "Repayment";

-- Drop the PaymentSchedule table
DROP TABLE "PaymentSchedule";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
