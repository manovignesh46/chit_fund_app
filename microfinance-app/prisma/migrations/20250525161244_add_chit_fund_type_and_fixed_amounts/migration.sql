-- AlterTable
ALTER TABLE `ChitFund` ADD COLUMN `chitFundType` VARCHAR(191) NOT NULL DEFAULT 'Auction';

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

-- AddForeignKey
ALTER TABLE `ChitFundFixedAmount` ADD CONSTRAINT `ChitFundFixedAmount_chitFundId_fkey` FOREIGN KEY (`chitFundId`) REFERENCES `ChitFund`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentSchedule` ADD CONSTRAINT `PaymentSchedule_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
