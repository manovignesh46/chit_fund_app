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

    // Get member IDs from request body
    const body = await request.json();
    const { memberIds } = body;

    // Validate member IDs
    if (!memberIds || !Array.isArray(memberIds)) {
      return NextResponse.json(
        { error: 'Invalid member IDs' },
        { status: 400 }
      );
    }

    // Convert string IDs to numbers if needed
    const numericMemberIds = memberIds.map(id => typeof id === 'string' ? parseInt(id, 10) : id);

    // Fetch members with their chit funds and loans
    const members = await prismaAny.globalMember.findMany({
      where: {
        id: { in: numericMemberIds },
        createdById: currentUserId,
      },
      include: {
        chitFundMembers: {
          include: {
            chitFund: {
              select: {
                id: true,
                name: true,
                status: true,
                currentMonth: true,
                duration: true,
                monthlyContribution: true,
              },
            },
            contributions: true,
          },
        },
        loans: {
          select: {
            id: true,
            loanType: true,
            amount: true,
            status: true,
            disbursementDate: true,
            remainingAmount: true,
            overdueAmount: true,
            missedPayments: true,
          },
        },
        _count: {
          select: {
            chitFundMembers: true,
            loans: true,
          },
        },
      },
    });

    if (members.length === 0) {
      return NextResponse.json(
        { error: 'No members found with the provided IDs' },
        { status: 404 }
      );
    }

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new();

    // 1. Members Sheet
    const membersData = members.map((member: any) => ({
      'Member ID': member.id,
      'Name': member.name,
      'Contact': member.contact,
      'Email': member.email || 'N/A',
      'Address': member.address || 'N/A',
      'Notes': member.notes || 'N/A',
      'Chit Funds Count': member._count.chitFundMembers,
      'Loans Count': member._count.loans,
      'Created At': formatDate(member.createdAt),
      'Updated At': formatDate(member.updatedAt),
    }));

    const membersWS = XLSX.utils.json_to_sheet(membersData);
    XLSX.utils.book_append_sheet(wb, membersWS, 'Members');

    // 2. Chit Funds Sheet - One sheet per member
    for (const member of members) {
      if (member.chitFundMembers.length > 0) {
        const chitFundsData = member.chitFundMembers.map((membership: any) => ({
          'Chit Fund ID': membership.chitFund.id,
          'Chit Fund Name': membership.chitFund.name,
          'Status': membership.chitFund.status,
          'Current Month': membership.chitFund.currentMonth,
          'Duration': membership.chitFund.duration,
          'Monthly Contribution': membership.contribution || membership.chitFund.monthlyContribution,
          'Join Date': formatDate(membership.joinDate),
          'Auction Won': membership.auctionWon ? 'Yes' : 'No',
          'Auction Month': membership.auctionMonth || 'N/A',
          'Contributions Count': membership.contributions.length,
          'Missed Contributions': calculateMissedContributions(membership),
          'Pending Amount': calculatePendingAmount(membership),
        }));

        if (chitFundsData.length > 0) {
          const memberName = member.name.replace(/[^a-zA-Z0-9]/g, '_');
          const chitFundsWS = XLSX.utils.json_to_sheet(chitFundsData);
          XLSX.utils.book_append_sheet(wb, chitFundsWS, `${memberName.substring(0, 28)}_ChitFunds`);
        }
      }
    }

    // 3. Loans Sheet - One sheet per member
    for (const member of members) {
      if (member.loans.length > 0) {
        const loansData = member.loans.map((loan: any) => ({
          'Loan ID': loan.id,
          'Loan Type': loan.loanType,
          'Amount': loan.amount,
          'Status': loan.status,
          'Disbursement Date': formatDate(loan.disbursementDate),
          'Remaining Amount': loan.remainingAmount,
          'Overdue Amount': loan.overdueAmount,
          'Missed Payments': loan.missedPayments,
        }));

        if (loansData.length > 0) {
          const memberName = member.name.replace(/[^a-zA-Z0-9]/g, '_');
          const loansWS = XLSX.utils.json_to_sheet(loansData);
          XLSX.utils.book_append_sheet(wb, loansWS, `${memberName.substring(0, 28)}_Loans`);
        }
      }
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Format filename
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    let filename;
    if (members.length === 1) {
      const memberName = members[0].name.replace(/[^a-zA-Z0-9]/g, '_');
      filename = `Member_${memberName}_${dateStr}.xlsx`;
    } else {
      filename = `Members_Export_${dateStr}.xlsx`;
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
function calculateMissedContributions(membership: any): number {
  if (!membership.chitFund || !membership.contributions) return 0;
  
  const currentMonth = membership.chitFund.currentMonth;
  if (!currentMonth) return 0;
  
  // Get all months that have contributions
  const contributedMonths = membership.contributions.map((c: any) => c.month);
  
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
function calculatePendingAmount(membership: any): number {
  if (!membership.chitFund || !membership.contributions) return 0;
  
  const currentMonth = membership.chitFund.currentMonth;
  if (!currentMonth) return 0;
  
  // Calculate missed contributions amount
  const missedContributions = calculateMissedContributions(membership);
  const contributionAmount = membership.contribution || membership.chitFund.monthlyContribution;
  let pendingAmount = missedContributions * contributionAmount;
  
  // Add any balance from partial payments
  for (const contribution of membership.contributions) {
    if (contribution.balance > 0) {
      pendingAmount += contribution.balance;
    }
  }
  
  return pendingAmount;
}
