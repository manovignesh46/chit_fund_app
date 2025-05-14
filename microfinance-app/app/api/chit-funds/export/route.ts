import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
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
    const summaryData = chitFunds.map(fund => ({
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
      'Cash Inflow': fund.contributions.reduce((sum, contribution) => sum + contribution.amount, 0),
      'Cash Outflow': fund.auctions.reduce((sum, auction) => sum + auction.amount, 0),
      'Profit': calculateProfit(fund),
      'Outside Amount': calculateOutsideAmount(fund),
    }));

    const summaryWS = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWS, 'Chit Funds Summary');

    // 2. Create individual sheets for each chit fund
    chitFunds.forEach(fund => {
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
        'Cash Inflow': fund.contributions.reduce((sum, contribution) => sum + contribution.amount, 0),
        'Cash Outflow': fund.auctions.reduce((sum, auction) => sum + auction.amount, 0),
        'Profit': calculateProfit(fund),
        'Outside Amount': calculateOutsideAmount(fund),
      };

      const fundWS = XLSX.utils.json_to_sheet([fundDetails]);
      
      // Add some space
      XLSX.utils.sheet_add_aoa(fundWS, [['']], { origin: -1 });
      XLSX.utils.sheet_add_aoa(fundWS, [['Members']], { origin: -1 });
      
      // Add members data
      const membersData = fund.members.map(member => ({
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
      
      XLSX.utils.sheet_add_json(fundWS, membersData, { origin: -1, skipHeader: false });
      
      // Add some space
      XLSX.utils.sheet_add_aoa(fundWS, [['']], { origin: -1 });
      XLSX.utils.sheet_add_aoa(fundWS, [['Auctions']], { origin: -1 });
      
      // Add auctions data
      const auctionsData = fund.auctions.map(auction => ({
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
      
      XLSX.utils.sheet_add_json(fundWS, auctionsData, { origin: -1, skipHeader: false });
      
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
