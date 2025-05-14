import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import * as XLSX from 'xlsx';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get the current user ID from the request
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const id = context.params.id;
    const chitFundId = parseInt(id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    // Fetch the chit fund with all related data
    const chitFund = await prismaAny.chitFund.findFirst({
      where: {
        id: chitFundId,
        createdById: currentUserId,
      },
      include: {
        members: {
          include: {
            globalMember: true,
            contributions: true,
          },
        },
        auctions: {
          include: {
            winner: {
              include: {
                globalMember: true,
              },
            },
          },
          orderBy: {
            month: 'asc',
          },
        },
        contributions: {
          include: {
            member: {
              include: {
                globalMember: true,
              },
            },
          },
          orderBy: [
            { month: 'asc' },
            { memberId: 'asc' },
          ],
        },
      },
    });

    if (!chitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new();

    // 1. Chit Fund Details Sheet
    const chitFundDetails = {
      'Name': chitFund.name,
      'Total Amount': chitFund.totalAmount,
      'Monthly Contribution': chitFund.monthlyContribution,
      'Duration (Months)': chitFund.duration,
      'Current Month': chitFund.currentMonth,
      'Status': chitFund.status,
      'Start Date': formatDate(chitFund.startDate),
      'End Date': chitFund.endDate ? formatDate(chitFund.endDate) : 'N/A',
      'Members Count': chitFund.members.length,
      'Auctions Count': chitFund.auctions.length,
      'Contributions Count': chitFund.contributions.length,
      'Notes': chitFund.notes || '',
    };

    const detailsWS = XLSX.utils.json_to_sheet([chitFundDetails]);
    XLSX.utils.book_append_sheet(wb, detailsWS, 'Chit Fund Details');

    // 2. Members Sheet
    const membersData = chitFund.members.map(member => ({
      'Member ID': member.id,
      'Name': member.globalMember.name,
      'Contact': member.globalMember.contact,
      'Email': member.globalMember.email || 'N/A',
      'Address': member.globalMember.address || 'N/A',
      'Join Date': formatDate(member.joinDate),
      'Contribution Amount': member.contribution || chitFund.monthlyContribution,
      'Contributions Count': member.contributions.length,
      'Won Auction': member.auctionWon ? 'Yes' : 'No',
      'Auction Month': member.auctionMonth || 'N/A',
    }));

    const membersWS = XLSX.utils.json_to_sheet(membersData);
    XLSX.utils.book_append_sheet(wb, membersWS, 'Members');

    // 3. Auctions Sheet
    const auctionsData = chitFund.auctions.map(auction => ({
      'Auction ID': auction.id,
      'Month': auction.month,
      'Date': formatDate(auction.date),
      'Winner': auction.winner?.globalMember?.name || `Member ID: ${auction.winnerId}`,
      'Amount': auction.amount,
      'Discount': chitFund.totalAmount - auction.amount,
      'Discount %': ((1 - auction.amount / chitFund.totalAmount) * 100).toFixed(2) + '%',
      'Lowest Bid': auction.lowestBid || 'N/A',
      'Highest Bid': auction.highestBid || 'N/A',
      'Number of Bidders': auction.numberOfBidders || 'N/A',
      'Notes': auction.notes || '',
    }));

    const auctionsWS = XLSX.utils.json_to_sheet(auctionsData);
    XLSX.utils.book_append_sheet(wb, auctionsWS, 'Auctions');

    // 4. Contributions Sheet
    const contributionsData = chitFund.contributions.map(contribution => ({
      'Contribution ID': contribution.id,
      'Month': contribution.month,
      'Member': contribution.member?.globalMember?.name || `Member ID: ${contribution.memberId}`,
      'Amount': contribution.amount,
      'Paid Date': formatDate(contribution.paidDate),
      'Balance': contribution.balance || 0,
      'Balance Payment Status': contribution.balancePaymentStatus || 'N/A',
      'Balance Payment Date': contribution.balancePaymentDate ? formatDate(contribution.balancePaymentDate) : 'N/A',
      'Actual Balance Payment Date': contribution.actualBalancePaymentDate ? formatDate(contribution.actualBalancePaymentDate) : 'N/A',
      'Notes': contribution.notes || '',
    }));

    const contributionsWS = XLSX.utils.json_to_sheet(contributionsData);
    XLSX.utils.book_append_sheet(wb, contributionsWS, 'Contributions');

    // 5. Financial Summary Sheet
    // Calculate total cash inflow (contributions)
    const totalContributions = chitFund.contributions.reduce((sum, contribution) => sum + contribution.amount, 0);

    // Calculate total cash outflow (auctions)
    const totalAuctions = chitFund.auctions.reduce((sum, auction) => sum + auction.amount, 0);

    // Calculate profit
    const profit = totalContributions - totalAuctions;

    // Calculate outside amount (if cash outflow exceeds inflow)
    const outsideAmount = Math.max(0, totalAuctions - totalContributions);

    const summaryData = {
      'Total Cash Inflow (Contributions)': totalContributions,
      'Total Cash Outflow (Auctions)': totalAuctions,
      'Profit': profit,
      'Outside Amount': outsideAmount,
      'Completed Months': chitFund.auctions.length,
      'Remaining Months': chitFund.duration - chitFund.auctions.length,
      'Progress': ((chitFund.auctions.length / chitFund.duration) * 100).toFixed(2) + '%',
    };

    const summaryWS = XLSX.utils.json_to_sheet([summaryData]);
    XLSX.utils.book_append_sheet(wb, summaryWS, 'Financial Summary');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Format filename
    const chitFundName = chitFund.name.replace(/[^a-zA-Z0-9]/g, '_');
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `${chitFundName}_${dateStr}.xlsx`;

    // Set response headers for file download
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('Error exporting chit fund details:', error);
    return NextResponse.json(
      { error: 'Failed to export chit fund details' },
      { status: 500 }
    );
  }
}

// Helper function to format date
function formatDate(date: Date | string): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
