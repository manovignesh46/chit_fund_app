import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';
import * as XLSX from 'xlsx';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function POST(request: NextRequest) {
  try {
    // Get the current user ID from the request
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get chit fund IDs from request body
    const { chitFundIds } = await request.json();

    if (!chitFundIds || !Array.isArray(chitFundIds) || chitFundIds.length === 0) {
      return NextResponse.json(
        { error: 'No chit fund IDs provided' },
        { status: 400 }
      );
    }

    // Convert string IDs to numbers if needed
    const numericChitFundIds = chitFundIds.map(id => typeof id === 'string' ? parseInt(id, 10) : id);

    // Fetch all selected chit funds with their related data
    const chitFunds = await prismaAny.chitFund.findMany({
      where: {
        id: { in: numericChitFundIds },
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

    if (!chitFunds || chitFunds.length === 0) {
      return NextResponse.json(
        { error: 'No chit funds found' },
        { status: 404 }
      );
    }

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet - List all chit funds
    const summaryData = chitFunds.map((fund: any) => ({
      'ID': fund.id,
      'Name': fund.name,
      'Total Amount': fund.totalAmount,
      'Monthly Contribution': fund.monthlyContribution,
      'Duration (Months)': fund.duration,
      'Current Month': fund.currentMonth,
      'Status': fund.status,
      'Start Date': formatDate(fund.startDate),
      'End Date': fund.endDate ? formatDate(fund.endDate) : 'N/A',
      'Members Count': fund.members.length,
      'Auctions Count': fund.auctions.length,
      'Contributions Count': fund.contributions.length,
      'Cash Inflow': fund.contributions.reduce((sum: number, contribution: any) => sum + contribution.amount, 0),
      'Cash Outflow': fund.auctions.reduce((sum: number, auction: any) => sum + auction.amount, 0),
      'Profit': calculateProfit(fund),
      'Outside Amount': calculateOutsideAmount(fund),
    }));

    const summaryWS = XLSX.utils.json_to_sheet(summaryData);

    // Define column widths for summary sheet
    summaryWS['!cols'] = [
      { width: 8 },  // ID
      { width: 25 }, // Name
      { width: 15 }, // Total Amount
      { width: 20 }, // Monthly Contribution
      { width: 15 }, // Duration (Months)
      { width: 15 }, // Current Month
      { width: 12 }, // Status
      { width: 20 }, // Start Date
      { width: 20 }, // End Date
      { width: 15 }, // Members Count
      { width: 15 }, // Auctions Count
      { width: 20 }, // Contributions Count
      { width: 15 }, // Cash Inflow
      { width: 15 }, // Cash Outflow
      { width: 12 }, // Profit
      { width: 15 }, // Outside Amount
    ];

    // Apply bold formatting to header row
    if (summaryData.length > 0) {
      const summaryRange = XLSX.utils.decode_range(summaryWS['!ref'] || 'A1:P1');
      for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!summaryWS[cellRef]) continue;
        summaryWS[cellRef].s = { font: { bold: true } };
      }
    }

    XLSX.utils.book_append_sheet(wb, summaryWS, 'Chit Funds Summary');

    // 2. Create individual sheets for each chit fund
    chitFunds.forEach((fund: any) => {
      // Create a sheet for this chit fund's details
      const sheetName = `Fund ${fund.id} - ${truncateSheetName(fund.name)}`;

      // Fund details
      const fundDetails = {
        'Name': fund.name,
        'Total Amount': fund.totalAmount,
        'Monthly Contribution': fund.monthlyContribution,
        'Duration (Months)': fund.duration,
        'Current Month': fund.currentMonth,
        'Status': fund.status,
        'Start Date': formatDate(fund.startDate),
        'End Date': fund.endDate ? formatDate(fund.endDate) : 'N/A',
        'Members Count': fund.members.length,
        'Auctions Count': fund.auctions.length,
        'Contributions Count': fund.contributions.length,
        'Notes': fund.notes || '',
        'Cash Inflow': fund.contributions.reduce((sum: number, contribution: any) => sum + contribution.amount, 0),
        'Cash Outflow': fund.auctions.reduce((sum: number, auction: any) => sum + auction.amount, 0),
        'Profit': calculateProfit(fund),
        'Outside Amount': calculateOutsideAmount(fund),
      };

      const fundWS = XLSX.utils.json_to_sheet([fundDetails]);

      // Define column widths for fund details
      fundWS['!cols'] = [
        { width: 25 }, // Name/Property
        { width: 25 }, // Value
      ];

      // Apply bold formatting to property names
      const fundRange = XLSX.utils.decode_range(fundWS['!ref'] || 'A1:B1');
      for (let row = fundRange.s.r; row <= fundRange.e.r; row++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
        if (!fundWS[cellRef]) continue;
        fundWS[cellRef].s = { font: { bold: true } };
      }

      // Add some space
      XLSX.utils.sheet_add_aoa(fundWS, [['']], { origin: -1 });
      XLSX.utils.sheet_add_aoa(fundWS, [['Members']], { origin: -1 });

      // Apply bold formatting to the "Members" header
      const membersHeaderRef = XLSX.utils.encode_cell({
        r: fundRange.e.r + 2,
        c: 0
      });
      if (fundWS[membersHeaderRef]) {
        fundWS[membersHeaderRef].s = { font: { bold: true, size: 14 } };
      }

      // Add members data
      const membersData = fund.members.map((member: any) => ({
        'Member ID': member.id,
        'Name': member.globalMember.name,
        'Contact': member.globalMember.contact,
        'Email': member.globalMember.email || 'N/A',
        'Address': member.globalMember.address || 'N/A',
        'Join Date': formatDate(member.joinDate),
        'Contribution Amount': member.contribution || fund.monthlyContribution,
        'Contributions Count': member.contributions.length,
        'Won Auction': member.auctionWon ? 'Yes' : 'No',
        'Auction Month': member.auctionMonth || 'N/A',
      }));

      // Get the current row count to determine where members data starts
      const membersStartRow = fundRange.e.r + 3; // Fund details + empty row + "Members" header

      // Add members data
      XLSX.utils.sheet_add_json(fundWS, membersData, { origin: -1, skipHeader: false });

      // Apply bold formatting to members header row and set column widths
      if (membersData.length > 0) {
        // Define column widths for members section
        if (!fundWS['!cols']) {
          fundWS['!cols'] = [];
        }

        // Update column widths if needed
        const membersCols = [
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

        // Merge with existing column definitions
        for (let i = 0; i < membersCols.length; i++) {
          fundWS['!cols'][i] = membersCols[i];
        }

        // Apply bold formatting to members header row
        const membersHeaderRow = membersStartRow;
        for (let col = 0; col < Object.keys(membersData[0]).length; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: membersHeaderRow, c: col });
          if (!fundWS[cellRef]) continue;
          fundWS[cellRef].s = { font: { bold: true } };
        }
      }

      // Add some space
      XLSX.utils.sheet_add_aoa(fundWS, [['']], { origin: -1 });
      XLSX.utils.sheet_add_aoa(fundWS, [['Auctions']], { origin: -1 });

      // Apply bold formatting to the "Auctions" header
      const currentRef = fundWS['!ref'] || 'A1';
      const currentRange = XLSX.utils.decode_range(currentRef);
      const auctionsHeaderRef = XLSX.utils.encode_cell({
        r: currentRange.e.r,
        c: 0
      });

      if (fundWS[auctionsHeaderRef]) {
        fundWS[auctionsHeaderRef].s = { font: { bold: true, size: 14 } };
      }

      // Add auctions data
      const auctionsData = fund.auctions.map((auction: any) => ({
        'Auction ID': auction.id,
        'Month': auction.month,
        'Date': formatDate(auction.date),
        'Winner': auction.winner?.globalMember?.name || `Member ID: ${auction.winnerId}`,
        'Amount': auction.amount,
        'Discount': fund.totalAmount - auction.amount,
        'Discount %': ((1 - auction.amount / fund.totalAmount) * 100).toFixed(2) + '%',
        'Lowest Bid': auction.lowestBid || 'N/A',
        'Highest Bid': auction.highestBid || 'N/A',
        'Number of Bidders': auction.numberOfBidders || 'N/A',
        'Notes': auction.notes || '',
      }));

      // Get the current row count to determine where auctions data starts
      const currentRef2 = fundWS['!ref'] || 'A1';
      const currentRange2 = XLSX.utils.decode_range(currentRef2);
      const auctionsStartRow = currentRange2.e.r + 1; // Current last row + 1

      // Add auctions data
      XLSX.utils.sheet_add_json(fundWS, auctionsData, { origin: -1, skipHeader: false });

      // Apply bold formatting to auctions header row
      if (auctionsData.length > 0) {
        // Define column widths for auctions section
        if (!fundWS['!cols']) {
          fundWS['!cols'] = [];
        }

        // Update column widths if needed
        const auctionsCols = [
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

        // Merge with existing column definitions
        for (let i = 0; i < auctionsCols.length; i++) {
          fundWS['!cols'][i] = auctionsCols[i];
        }

        // Apply bold formatting to auctions header row
        for (let col = 0; col < Object.keys(auctionsData[0]).length; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: auctionsStartRow, c: col });
          if (!fundWS[cellRef]) continue;
          fundWS[cellRef].s = { font: { bold: true } };
        }
      }

      // Add the sheet to the workbook
      XLSX.utils.book_append_sheet(wb, fundWS, sheetName);
    });

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Format filename
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `ChitFunds_Export_${dateStr}.xlsx`;

    // Set response headers for file download
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('Error exporting chit funds:', error);
    return NextResponse.json(
      { error: 'Failed to export chit funds' },
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

// Helper function to calculate profit
function calculateProfit(chitFund: any): number {
  const totalContributions = chitFund.contributions.reduce((sum: number, contribution: any) => sum + contribution.amount, 0);
  const totalAuctions = chitFund.auctions.reduce((sum: number, auction: any) => sum + auction.amount, 0);
  return totalContributions - totalAuctions;
}

// Helper function to calculate outside amount
function calculateOutsideAmount(chitFund: any): number {
  const totalContributions = chitFund.contributions.reduce((sum: number, contribution: any) => sum + contribution.amount, 0);
  const totalAuctions = chitFund.auctions.reduce((sum: number, auction: any) => sum + auction.amount, 0);
  return Math.max(0, totalAuctions - totalContributions);
}

// Helper function to truncate sheet name to valid Excel sheet name length
function truncateSheetName(name: string): string {
  // Excel sheet names are limited to 31 characters
  const maxLength = 25; // Leave room for "Fund X - " prefix
  return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
}
