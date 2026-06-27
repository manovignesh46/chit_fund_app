-- CreateTable
CREATE TABLE "AuctionBooking" (
    "id" SERIAL NOT NULL,
    "chitFundId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuctionBooking_chitFundId_memberId_key" ON "AuctionBooking"("chitFundId", "memberId");

-- CreateIndex
CREATE INDEX "AuctionBooking_chitFundId_idx" ON "AuctionBooking"("chitFundId");

-- CreateIndex
CREATE INDEX "AuctionBooking_chitFundId_month_idx" ON "AuctionBooking"("chitFundId", "month");

-- AddForeignKey
ALTER TABLE "AuctionBooking" ADD CONSTRAINT "AuctionBooking_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES "ChitFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBooking" ADD CONSTRAINT "AuctionBooking_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
