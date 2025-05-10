-- AlterTable
ALTER TABLE "Auction" ADD COLUMN "highestBid" REAL;
ALTER TABLE "Auction" ADD COLUMN "lowestBid" REAL;
ALTER TABLE "Auction" ADD COLUMN "notes" TEXT;
ALTER TABLE "Auction" ADD COLUMN "numberOfBidders" INTEGER;
