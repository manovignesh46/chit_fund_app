-- Links a ledger entry to the contribution whose outstanding balance it pays.
-- Additive only: existing rows keep NULL and are otherwise untouched.
ALTER TABLE "Transaction" ADD COLUMN "balanceContributionId" INTEGER;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_balanceContributionId_fkey"
  FOREIGN KEY ("balanceContributionId") REFERENCES "Contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Transaction_balanceContributionId_idx" ON "Transaction"("balanceContributionId");
