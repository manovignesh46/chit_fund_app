ALTER TABLE "Loan"
  ADD COLUMN "nonRecoverableAt" TIMESTAMP(3),
  ADD COLUMN "nonRecoverableReason" TEXT,
  ADD COLUMN "nonRecoverableNotes" TEXT,
  ADD COLUMN "recoveryPrincipalAtMark" DOUBLE PRECISION,
  ADD COLUMN "recoveryDuesAtMark" DOUBLE PRECISION,
  ADD COLUMN "recoveryInterestOutstanding" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "recoveryAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "recoveryOutcome" TEXT;

ALTER TABLE "Repayment"
  ADD COLUMN "principalComponent" DOUBLE PRECISION,
  ADD COLUMN "interestComponent" DOUBLE PRECISION,
  ADD COLUMN "notes" TEXT;

CREATE TABLE "LoanRecoveryEvent" (
  "id" SERIAL NOT NULL,
  "loanId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "requestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanRecoveryEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoanRecoveryEvent_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoanRecoveryEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LoanRecoveryEvent_loanId_requestId_key" ON "LoanRecoveryEvent"("loanId", "requestId");
CREATE INDEX "LoanRecoveryEvent_loanId_createdAt_idx" ON "LoanRecoveryEvent"("loanId", "createdAt");
