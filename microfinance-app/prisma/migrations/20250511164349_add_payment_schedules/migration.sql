-- CreateTable
CREATE TABLE "PaymentSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loanId" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "period" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "actualPaymentDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentSchedule_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Repayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" REAL NOT NULL,
    "paidDate" DATETIME NOT NULL,
    "loanId" INTEGER NOT NULL,
    "paymentType" TEXT DEFAULT 'full',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "paymentScheduleId" INTEGER,
    CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Repayment_paymentScheduleId_fkey" FOREIGN KEY ("paymentScheduleId") REFERENCES "PaymentSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Repayment" ("amount", "createdAt", "id", "loanId", "paidDate", "paymentType", "updatedAt") SELECT "amount", "createdAt", "id", "loanId", "paidDate", "paymentType", "updatedAt" FROM "Repayment";
DROP TABLE "Repayment";
ALTER TABLE "new_Repayment" RENAME TO "Repayment";
CREATE UNIQUE INDEX "Repayment_paymentScheduleId_key" ON "Repayment"("paymentScheduleId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
