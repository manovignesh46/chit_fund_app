-- CreateEnum
CREATE TYPE "RepaymentType" AS ENUM ('REGULAR', 'INTEREST_ONLY', 'PARTIAL');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChitFund" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "monthlyContribution" DOUBLE PRECISION NOT NULL,
    "firstMonthContribution" DOUBLE PRECISION,
    "duration" INTEGER NOT NULL,
    "membersCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "startDate" TIMESTAMP(3) NOT NULL,
    "currentMonth" INTEGER NOT NULL DEFAULT 1,
    "nextAuctionDate" TIMESTAMP(3),
    "description" TEXT,
    "chitFundType" TEXT NOT NULL DEFAULT 'Auction',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "ChitFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalMember" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "GlobalMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "globalMemberId" INTEGER NOT NULL,
    "chitFundId" INTEGER NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auctionWon" BOOLEAN NOT NULL DEFAULT false,
    "auctionMonth" INTEGER,
    "contribution" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" INTEGER NOT NULL,
    "paidDate" TIMESTAMP(3) NOT NULL,
    "memberId" INTEGER NOT NULL,
    "chitFundId" INTEGER NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balancePaymentDate" TIMESTAMP(3),
    "balancePaymentStatus" TEXT DEFAULT 'Pending',
    "actualBalancePaymentDate" TIMESTAMP(3),
    "notes" TEXT,
    "collected_by_id" INTEGER,
    "entered_by_id" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transactionId" INTEGER,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" SERIAL NOT NULL,
    "chitFundId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "winnerId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "lowestBid" DOUBLE PRECISION,
    "highestBid" DOUBLE PRECISION,
    "numberOfBidders" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disbursed_by_id" INTEGER,
    "entered_by_id" INTEGER,
    "transactionId" INTEGER,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChitFundFixedAmount" (
    "id" SERIAL NOT NULL,
    "chitFundId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChitFundFixedAmount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" SERIAL NOT NULL,
    "borrowerId" INTEGER NOT NULL,
    "loanType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "documentCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentMonth" INTEGER NOT NULL DEFAULT 0,
    "installmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL,
    "disbursementDate" TIMESTAMP(3) NOT NULL,
    "repaymentType" TEXT NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "overdueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "missedPayments" INTEGER NOT NULL DEFAULT 0,
    "nextPaymentDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Active',
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "disbursed_by_id" INTEGER,
    "entered_by_id" INTEGER,
    "transactionId" INTEGER,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repayment" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidDate" TIMESTAMP(3) NOT NULL,
    "period" INTEGER NOT NULL,
    "loanId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentType" TEXT NOT NULL,
    "collected_by_id" INTEGER,
    "createdById" INTEGER,
    "entered_by_id" INTEGER,
    "transactionId" INTEGER,

    CONSTRAINT "Repayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSchedule" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "actualPaymentDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" SERIAL NOT NULL,
    "emailType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "sentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "recipients" TEXT NOT NULL,
    "fileName" TEXT,
    "isRecovery" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "from_partner" TEXT,
    "to_partner" TEXT,
    "action_performer" TEXT NOT NULL,
    "entered_by" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "from_partner_id" INTEGER,
    "to_partner_id" INTEGER,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerMonthlySummary" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "closingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanRepayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanDisbursement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chitContributions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "auctionPayout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerMonthlySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ChitFund_createdById_idx" ON "ChitFund"("createdById");

-- CreateIndex
CREATE INDEX "GlobalMember_createdById_idx" ON "GlobalMember"("createdById");

-- CreateIndex
CREATE INDEX "Member_chitFundId_idx" ON "Member"("chitFundId");

-- CreateIndex
CREATE INDEX "Member_globalMemberId_idx" ON "Member"("globalMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_transactionId_key" ON "Contribution"("transactionId");

-- CreateIndex
CREATE INDEX "Contribution_chitFundId_idx" ON "Contribution"("chitFundId");

-- CreateIndex
CREATE INDEX "Contribution_memberId_idx" ON "Contribution"("memberId");

-- CreateIndex
CREATE INDEX "Contribution_collected_by_id_idx" ON "Contribution"("collected_by_id");

-- CreateIndex
CREATE INDEX "Contribution_entered_by_id_idx" ON "Contribution"("entered_by_id");

-- CreateIndex
CREATE INDEX "Contribution_createdById_idx" ON "Contribution"("createdById");

-- CreateIndex
CREATE INDEX "Contribution_transactionId_idx" ON "Contribution"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_transactionId_key" ON "Auction"("transactionId");

-- CreateIndex
CREATE INDEX "Auction_chitFundId_idx" ON "Auction"("chitFundId");

-- CreateIndex
CREATE INDEX "Auction_winnerId_idx" ON "Auction"("winnerId");

-- CreateIndex
CREATE INDEX "Auction_disbursed_by_id_idx" ON "Auction"("disbursed_by_id");

-- CreateIndex
CREATE INDEX "Auction_entered_by_id_idx" ON "Auction"("entered_by_id");

-- CreateIndex
CREATE INDEX "Auction_transactionId_idx" ON "Auction"("transactionId");

-- CreateIndex
CREATE INDEX "ChitFundFixedAmount_chitFundId_idx" ON "ChitFundFixedAmount"("chitFundId");

-- CreateIndex
CREATE UNIQUE INDEX "ChitFundFixedAmount_chitFundId_month_key" ON "ChitFundFixedAmount"("chitFundId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_transactionId_key" ON "Loan"("transactionId");

-- CreateIndex
CREATE INDEX "Loan_borrowerId_idx" ON "Loan"("borrowerId");

-- CreateIndex
CREATE INDEX "Loan_createdById_idx" ON "Loan"("createdById");

-- CreateIndex
CREATE INDEX "Loan_disbursed_by_id_idx" ON "Loan"("disbursed_by_id");

-- CreateIndex
CREATE INDEX "Loan_entered_by_id_idx" ON "Loan"("entered_by_id");

-- CreateIndex
CREATE INDEX "Loan_transactionId_idx" ON "Loan"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Repayment_transactionId_key" ON "Repayment"("transactionId");

-- CreateIndex
CREATE INDEX "Repayment_createdById_idx" ON "Repayment"("createdById");

-- CreateIndex
CREATE INDEX "Repayment_loanId_idx" ON "Repayment"("loanId");

-- CreateIndex
CREATE INDEX "Repayment_collected_by_id_idx" ON "Repayment"("collected_by_id");

-- CreateIndex
CREATE INDEX "Repayment_entered_by_id_idx" ON "Repayment"("entered_by_id");

-- CreateIndex
CREATE INDEX "Repayment_paidDate_idx" ON "Repayment"("paidDate");

-- CreateIndex
CREATE INDEX "Repayment_transactionId_idx" ON "Repayment"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentSchedule_loanId_idx" ON "PaymentSchedule"("loanId");

-- CreateIndex
CREATE INDEX "EmailLog_emailType_sentDate_idx" ON "EmailLog"("emailType", "sentDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_emailType_period_key" ON "EmailLog"("emailType", "period");

-- CreateIndex
CREATE INDEX "Partner_createdById_idx" ON "Partner"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_createdById_code_key" ON "Partner"("createdById", "code");

-- CreateIndex
CREATE INDEX "Transaction_createdById_idx" ON "Transaction"("createdById");

-- CreateIndex
CREATE INDEX "Transaction_from_partner_id_idx" ON "Transaction"("from_partner_id");

-- CreateIndex
CREATE INDEX "Transaction_to_partner_id_idx" ON "Transaction"("to_partner_id");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMonthlySummary_partnerId_month_key" ON "PartnerMonthlySummary"("partnerId", "month");

-- AddForeignKey
ALTER TABLE "ChitFund" ADD CONSTRAINT "ChitFund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalMember" ADD CONSTRAINT "GlobalMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES "ChitFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_globalMemberId_fkey" FOREIGN KEY ("globalMemberId") REFERENCES "GlobalMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES "ChitFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_disbursed_by_id_fkey" FOREIGN KEY ("disbursed_by_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES "ChitFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChitFundFixedAmount" ADD CONSTRAINT "ChitFundFixedAmount_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES "ChitFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_disbursed_by_id_fkey" FOREIGN KEY ("disbursed_by_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "GlobalMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_from_partner_id_fkey" FOREIGN KEY ("from_partner_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_to_partner_id_fkey" FOREIGN KEY ("to_partner_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerMonthlySummary" ADD CONSTRAINT "PartnerMonthlySummary_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
