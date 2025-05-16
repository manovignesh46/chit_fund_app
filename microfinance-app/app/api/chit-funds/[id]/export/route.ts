import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import * as XLSX from 'xlsx';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteParams
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

    const { id } = await params;
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

    // Define column widths for details sheet
    detailsWS['!cols'] = [
      { width: 25 }, // Property name
      { width: 30 }, // Value
    ];

    // Apply bold formatting to property names
    const detailsRange = XLSX.utils.decode_range(detailsWS['!ref'] || 'A1:B1');
    for (let row = detailsRange.s.r; row <= detailsRange.e.r; row++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
      if (!detailsWS[cellRef]) continue;
      detailsWS[cellRef].s = { font: { bold: true } };
    }

    XLSX.utils.book_append_sheet(wb, detailsWS, 'Chit Fund Details');

    // 2. Members Sheet
    const membersData = chitFund.members.map((member: any) => ({
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

    // Define column widths for members sheet
    membersWS['!cols'] = [
      { width: 10 },  // Member ID
      { width: 25 },  // Name
      { width: 15 },  // Contact
      { width: 25 },  // Email
      { width: 25 },  // Address
      { width: 15 },  // Join Date
      { width: 15 },  // Contribution Amount
      { width: 15 },  // Contributions Count
      { width: 10 },  // Won Auction
      { width: 15 },  // Auction Month
    ];

    // Apply bold formatting to header row
    if (membersData.length > 0) {
      const membersRange = XLSX.utils.decode_range(membersWS['!ref'] || 'A1:J1');
      for (let col = membersRange.s.c; col <= membersRange.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!membersWS[cellRef]) continue;
        membersWS[cellRef].s = { font: { bold: true } };
      }
    }

    XLSX.utils.book_append_sheet(wb, membersWS, 'Members');

    // 3. Auctions Sheet
    const auctionsData = chitFund.auctions.map((auction: any) => ({
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

    // Define column widths for auctions sheet
    auctionsWS['!cols'] = [
      { width: 10 },  // Auction ID
      { width: 10 },  // Month
      { width: 15 },  // Date
      { width: 25 },  // Winner
      { width: 15 },  // Amount
      { width: 15 },  // Discount
      { width: 15 },  // Discount %
      { width: 15 },  // Lowest Bid
      { width: 15 },  // Highest Bid
      { width: 15 },  // Number of Bidders
      { width: 25 },  // Notes
    ];

    // Apply bold formatting to header row
    if (auctionsData.length > 0) {
      const auctionsRange = XLSX.utils.decode_range(auctionsWS['!ref'] || 'A1:K1');
      for (let col = auctionsRange.s.c; col <= auctionsRange.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!auctionsWS[cellRef]) continue;
        auctionsWS[cellRef].s = { font: { bold: true } };
      }
    }

    XLSX.utils.book_append_sheet(wb, auctionsWS, 'Auctions');

    // 4. Contributions Sheet
    const contributionsData = chitFund.contributions.map((contribution: any) => ({
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

    // Define column widths for contributions sheet
    contributionsWS['!cols'] = [
      { width: 15 },  // Contribution ID
      { width: 10 },  // Month
      { width: 25 },  // Member
      { width: 15 },  // Amount
      { width: 15 },  // Paid Date
      { width: 15 },  // Balance
      { width: 20 },  // Balance Payment Status
      { width: 20 },  // Balance Payment Date
      { width: 20 },  // Actual Balance Payment Date
      { width: 25 },  // Notes
    ];

    // Apply bold formatting to header row
    if (contributionsData.length > 0) {
      const contributionsRange = XLSX.utils.decode_range(contributionsWS['!ref'] || 'A1:J1');
      for (let col = contributionsRange.s.c; col <= contributionsRange.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!contributionsWS[cellRef]) continue;
        contributionsWS[cellRef].s = { font: { bold: true } };
      }
    }

    XLSX.utils.book_append_sheet(wb, contributionsWS, 'Contributions');

    // 5. Financial Summary Sheet
    // Calculate total cash inflow (contributions)
    const totalContributions = chitFund.contributions.reduce((sum: number, contribution: any) => sum + contribution.amount, 0);

    // Calculate total cash outflow (auctions)
    const totalAuctions = chitFund.auctions.reduce((sum: number, auction: any) => sum + auction.amount, 0);

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

    // Define column widths for summary sheet
    summaryWS['!cols'] = [
      { width: 30 }, // Property name
      { width: 20 }, // Value
    ];

    // Apply bold formatting to property names
    const summaryRange = XLSX.utils.decode_range(summaryWS['!ref'] || 'A1:B1');
    for (let row = summaryRange.s.r; row <= summaryRange.e.r; row++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
      if (!summaryWS[cellRef]) continue;
      summaryWS[cellRef].s = { font: { bold: true } };
    }

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
