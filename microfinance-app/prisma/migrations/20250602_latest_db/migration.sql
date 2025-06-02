-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'user',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChitFund` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `totalAmount` DOUBLE NOT NULL,
    `monthlyContribution` DOUBLE NOT NULL,
    `duration` INTEGER NOT NULL,
    `membersCount` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `startDate` DATETIME(3) NOT NULL,
    `currentMonth` INTEGER NOT NULL DEFAULT 1,
    `nextAuctionDate` DATETIME(3) NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `chitFundType` VARCHAR(191) NOT NULL DEFAULT 'Auction',
    `firstMonthContribution` DOUBLE NULL,

    INDEX `ChitFund_createdById_fkey`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GlobalMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `contact` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,

    INDEX `GlobalMember_createdById_fkey`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Member` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `globalMemberId` INTEGER NOT NULL,
    `chitFundId` INTEGER NOT NULL,
    `joinDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `auctionWon` BOOLEAN NOT NULL DEFAULT false,
    `auctionMonth` INTEGER NULL,
    `contribution` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Member_chitFundId_fkey`(`chitFundId`),
    INDEX `Member_globalMemberId_fkey`(`globalMemberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contribution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DOUBLE NOT NULL,
    `month` INTEGER NOT NULL,
    `paidDate` DATETIME(3) NOT NULL,
    `memberId` INTEGER NOT NULL,
    `chitFundId` INTEGER NOT NULL,
    `balance` DOUBLE NOT NULL DEFAULT 0,
    `balancePaymentDate` DATETIME(3) NULL,
    `balancePaymentStatus` VARCHAR(191) NULL DEFAULT 'Pending',
    `actualBalancePaymentDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `notes` VARCHAR(191) NULL,

    INDEX `Contribution_chitFundId_fkey`(`chitFundId`),
    INDEX `Contribution_memberId_fkey`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Auction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chitFundId` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `winnerId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `lowestBid` DOUBLE NULL,
    `highestBid` DOUBLE NULL,
    `numberOfBidders` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Auction_chitFundId_fkey`(`chitFundId`),
    INDEX `Auction_winnerId_fkey`(`winnerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChitFundFixedAmount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chitFundId` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChitFundFixedAmount_chitFundId_fkey`(`chitFundId`),
    UNIQUE INDEX `ChitFundFixedAmount_chitFundId_month_key`(`chitFundId`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Loan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `borrowerId` INTEGER NOT NULL,
    `loanType` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `interestRate` DOUBLE NOT NULL,
    `documentCharge` DOUBLE NOT NULL DEFAULT 0,
    `currentMonth` INTEGER NOT NULL DEFAULT 0,
    `installmentAmount` DOUBLE NOT NULL DEFAULT 0,
    `duration` INTEGER NOT NULL,
    `disbursementDate` DATETIME(3) NOT NULL,
    `repaymentType` VARCHAR(191) NOT NULL,
    `remainingAmount` DOUBLE NOT NULL,
    `overdueAmount` DOUBLE NOT NULL DEFAULT 0,
    `missedPayments` INTEGER NOT NULL DEFAULT 0,
    `nextPaymentDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `purpose` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,

    INDEX `Loan_borrowerId_fkey`(`borrowerId`),
    INDEX `Loan_createdById_fkey`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Repayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DOUBLE NOT NULL,
    `paidDate` DATETIME(3) NOT NULL,
    `loanId` INTEGER NOT NULL,
    `paymentType` VARCHAR(191) NOT NULL DEFAULT 'full',
    `period` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Repayment_loanId_fkey`(`loanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentSchedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loanId` INTEGER NOT NULL,
    `period` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `actualPaymentDate` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaymentSchedule_loanId_fkey`(`loanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `emailType` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `sentDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'sent',
    `recipients` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NULL,
    `isRecovery` BOOLEAN NOT NULL DEFAULT false,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailLog_emailType_sentDate_idx`(`emailType`, `sentDate`),
    UNIQUE INDEX `EmailLog_emailType_period_key`(`emailType`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChitFund` ADD CONSTRAINT `ChitFund_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GlobalMember` ADD CONSTRAINT `GlobalMember_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Member` ADD CONSTRAINT `Member_chitFundId_fkey` FOREIGN KEY (`chitFundId`) REFERENCES `ChitFund`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Member` ADD CONSTRAINT `Member_globalMemberId_fkey` FOREIGN KEY (`globalMemberId`) REFERENCES `GlobalMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contribution` ADD CONSTRAINT `Contribution_chitFundId_fkey` FOREIGN KEY (`chitFundId`) REFERENCES `ChitFund`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contribution` ADD CONSTRAINT `Contribution_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Auction` ADD CONSTRAINT `Auction_chitFundId_fkey` FOREIGN KEY (`chitFundId`) REFERENCES `ChitFund`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Auction` ADD CONSTRAINT `Auction_winnerId_fkey` FOREIGN KEY (`winnerId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChitFundFixedAmount` ADD CONSTRAINT `ChitFundFixedAmount_chitFundId_fkey` FOREIGN KEY (`chitFundId`) REFERENCES `ChitFund`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_borrowerId_fkey` FOREIGN KEY (`borrowerId`) REFERENCES `GlobalMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Repayment` ADD CONSTRAINT `Repayment_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentSchedule` ADD CONSTRAINT `PaymentSchedule_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

