import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../../lib/prisma';
import { getCurrentUserId } from '../../../../../../lib/auth';
import * as XLSX from 'xlsx';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
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

    // Get request body to determine which members to export
    // Import the middleware to parse form data
    const { parseFormData } = await import('./middleware');
    const { memberIds } = await parseFormData(request);

    // Verify the chit fund exists and belongs to the current user
    const chitFund = await prismaAny.chitFund.findFirst({
      where: {
        id: chitFundId,
        createdById: currentUserId,
      },
    });

    if (!chitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    // Fetch members with their contributions
    const membersQuery: any = {
      where: {
        chitFundId,
      },
      include: {
        globalMember: true,
        contributions: {
          orderBy: {
            month: 'asc',
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    };

    // If specific member IDs are provided, filter by them
    if (memberIds && memberIds.length > 0) {
      membersQuery.where.id = { in: memberIds.map((id: string | number) => Number(id)) };
    }

    const members = await prismaAny.member.findMany(membersQuery);

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
      'Members Count': chitFund.membersCount,
    };

    const detailsWS = XLSX.utils.json_to_sheet([chitFundDetails]);
    XLSX.utils.book_append_sheet(wb, detailsWS, 'Chit Fund Details');

    // 2. Members Sheet
    const membersData = members.map((member: any) => {
      // Calculate missed contributions
      const missedContributions = calculateMissedContributions(member, chitFund.currentMonth);

      // Calculate pending amount
      const pendingAmount = calculatePendingAmount(member, chitFund.monthlyContribution);

      return {
        'Member ID': member.id,
        'Name': member.globalMember.name,
        'Contact': member.globalMember.contact,
        'Email': member.globalMember.email || 'N/A',
        'Address': member.globalMember.address || 'N/A',
        'Join Date': formatDate(member.joinDate),
        'Contribution Amount': member.contribution || chitFund.monthlyContribution,
        'Contributions Count': member.contributions.length,
        'Missed Contributions': missedContributions,
        'Pending Amount': pendingAmount,
        'Won Auction': member.auctionWon ? 'Yes' : 'No',
        'Auction Month': member.auctionMonth || 'N/A',
      };
    });

    const membersWS = XLSX.utils.json_to_sheet(membersData);
    XLSX.utils.book_append_sheet(wb, membersWS, 'Members');

    // 3. Contributions Sheet - One sheet per member
    for (const member of members) {
      // Create a sheet for each member's contributions
      const contributionsData = member.contributions.map((contribution: any) => ({
        'Month': contribution.month,
        'Amount': contribution.amount,
        'Paid Date': formatDate(contribution.paidDate),
        'Balance': contribution.balance || 0,
        'Balance Status': contribution.balancePaymentStatus || 'N/A',
        'Balance Payment Date': contribution.balancePaymentDate ? formatDate(contribution.balancePaymentDate) : 'N/A',
        'Actual Balance Payment Date': contribution.actualBalancePaymentDate ? formatDate(contribution.actualBalancePaymentDate) : 'N/A',
        'Notes': contribution.notes || '',
      }));

      if (contributionsData.length > 0) {
        const memberName = member.globalMember.name.replace(/[^a-zA-Z0-9]/g, '_');
        const contributionsWS = XLSX.utils.json_to_sheet(contributionsData);
        XLSX.utils.book_append_sheet(wb, contributionsWS, `${memberName.substring(0, 28)}_Contributions`);
      }
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Format filename
    const chitFundName = chitFund.name.replace(/[^a-zA-Z0-9]/g, '_');
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    let filename;
    if (members.length === 1) {
      const memberName = members[0].globalMember.name.replace(/[^a-zA-Z0-9]/g, '_');
      filename = `${chitFundName}_${memberName}_${dateStr}.xlsx`;
    } else {
      filename = `${chitFundName}_Members_${dateStr}.xlsx`;
    }

    // Set response headers for file download
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('Error exporting members:', error);
    return NextResponse.json(
      { error: 'Failed to export members' },
      { status: 500 }
    );
  }
}

// Helper function to format date
function formatDate(dateString: string | Date): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Helper function to calculate missed contributions
function calculateMissedContributions(member: any, currentMonth: number): number {
  if (!member.contributions || !currentMonth) return 0;

  // Get all months that have contributions
  const contributedMonths = member.contributions.map((c: any) => c.month);

  // Count how many months from 1 to currentMonth are missing in contributedMonths
  let missedContributions = 0;
  for (let month = 1; month <= currentMonth; month++) {
    if (!contributedMonths.includes(month)) {
      missedContributions++;
    }
  }

  return missedContributions;
}

// Helper function to calculate pending amount
function calculatePendingAmount(member: any, monthlyContribution: number): number {
  if (!member.contributions) return 0;

  let pendingAmount = 0;

  // Add any balance from partial payments
  for (const contribution of member.contributions) {
    if (contribution.balance > 0 && contribution.balancePaymentStatus !== 'Paid') {
      pendingAmount += contribution.balance;
    }
  }

  // Add missed contributions
  const missedContributions = calculateMissedContributions(member, member.chitFund?.currentMonth);
  pendingAmount += missedContributions * (member.contribution || monthlyContribution);

  return pendingAmount;
}
