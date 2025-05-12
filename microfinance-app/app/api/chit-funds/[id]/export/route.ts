import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { apiCache } from '@/lib/cache';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chitFundId = Number(id);

        // Get chit fund details with all related data
        const chitFund = await prismaAny.chitFund.findUnique({
            where: { id: chitFundId },
            include: {
                members: {
                    include: {
                        globalMember: true,
                    }
                },
            }
        });

        if (!chitFund) {
            return NextResponse.json({ message: 'Chit fund not found' }, { status: 404 });
        }

        // Fetch ALL contributions for this chit fund (not paginated)
        const contributions = await prismaAny.contribution.findMany({
            where: { chitFundId: chitFundId },
            include: {
                member: {
                    include: {
                        globalMember: true,
                    }
                }
            },
            orderBy: [
                { month: 'asc' },
                { paidDate: 'asc' },
            ]
        });

        // Fetch ALL auctions for this chit fund
        const auctions = await prismaAny.auction.findMany({
            where: { chitFundId: chitFundId },
            include: {
                winner: {
                    include: {
                        globalMember: true,
                    }
                }
            },
            orderBy: { month: 'asc' }
        });

        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Calculate end date
        const startDate = new Date(chitFund.startDate);
        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + chitFund.duration);

        // Format chit fund details for the overview sheet
        // Using Record<string, any> type to allow adding properties dynamically
        const chitFundDetails: Record<string, any> = {
            'Chit Fund ID': chitFund.id,
            'Name': chitFund.name,
            'Total Amount': chitFund.totalAmount,
            'Monthly Contribution': chitFund.monthlyContribution,
            'Duration (months)': chitFund.duration,
            'Members Count': chitFund.membersCount,
            'Status': chitFund.status,
            'Start Date': formatDate(chitFund.startDate),
            'End Date': formatDate(endDate),
            'Current Month': chitFund.currentMonth,
            'Next Auction Date': chitFund.nextAuctionDate ? formatDate(chitFund.nextAuctionDate) : 'N/A',
            'Description': chitFund.description || 'N/A',
        };

        // Calculate financial summary
        let totalInflow = 0;
        let totalOutflow = 0;
        let totalProfit = 0;
        let totalBalance = 0;
        let outsideAmount = 0;

        // Calculate cash inflow from contributions
        if (contributions && contributions.length > 0) {
            contributions.forEach((contribution: any) => {
                totalInflow += contribution.amount;
                if (contribution.balance > 0 && contribution.balancePaymentStatus !== 'Paid') {
                    totalBalance += contribution.balance;
                }
            });
        }

        // Calculate cash outflow from auctions (payouts to winners)
        if (auctions && auctions.length > 0) {
            auctions.forEach((auction: any) => {
                totalOutflow += auction.amount;

                // Each auction's profit is the difference between the total monthly contribution and the auction amount
                const monthlyTotal = chitFund.monthlyContribution * chitFund.members.length;
                const auctionProfit = monthlyTotal - auction.amount;
                totalProfit += auctionProfit > 0 ? auctionProfit : 0;
            });
        }

        // If there are no auctions or the calculated profit is 0, but there's a difference between inflow and outflow,
        // use that difference as the profit (especially for completed chit funds)
        if ((auctions.length === 0 || totalProfit === 0) && totalInflow > totalOutflow) {
            totalProfit = totalInflow - totalOutflow;
        }

        // Calculate outside amount (when outflow exceeds inflow)
        if (totalOutflow > totalInflow) {
            outsideAmount = totalOutflow - totalInflow;
        }

        // Add financial summary to chitFundDetails
        chitFundDetails['Total Cash Inflow'] = totalInflow;
        chitFundDetails['Total Cash Outflow'] = totalOutflow;
        chitFundDetails['Total Profit'] = totalProfit;
        chitFundDetails['Outstanding Balance'] = totalBalance;
        chitFundDetails['Outside Amount'] = outsideAmount;

        // Create overview sheet
        const overviewSheet = XLSX.utils.json_to_sheet([chitFundDetails]);
        XLSX.utils.book_append_sheet(wb, overviewSheet, 'Overview');

        // Format members data for the members sheet
        const membersData = chitFund.members.map((member: any) => ({
            'Member ID': member.id,
            'Name': member.globalMember.name,
            'Contact': member.globalMember.contact,
            'Email': member.globalMember.email || 'N/A',
            'Join Date': formatDate(member.joinDate),
            'Monthly Contribution': member.contribution,
            'Auction Won': member.auctionWon ? 'Yes' : 'No',
            'Auction Month': member.auctionMonth || 'N/A',
        }));

        // Create members sheet
        const membersSheet = XLSX.utils.json_to_sheet(membersData);
        XLSX.utils.book_append_sheet(wb, membersSheet, 'Members');

        // Format contributions data for the contributions sheet
        const contributionsData = contributions.map((contribution: any) => ({
            'Contribution ID': contribution.id,
            'Member': contribution.member.globalMember.name,
            'Month': contribution.month,
            'Amount': contribution.amount,
            'Paid Date': formatDate(contribution.paidDate),
            'Balance': contribution.balance,
            'Balance Status': contribution.balancePaymentStatus || 'N/A',
            'Expected Balance Payment': contribution.balancePaymentDate ? formatDate(contribution.balancePaymentDate) : 'N/A',
            'Actual Balance Payment': contribution.actualBalancePaymentDate ? formatDate(contribution.actualBalancePaymentDate) : 'N/A',
        }));

        // Create contributions sheet
        const contributionsSheet = XLSX.utils.json_to_sheet(contributionsData);
        XLSX.utils.book_append_sheet(wb, contributionsSheet, 'Contributions');

        // Format auctions data for the auctions sheet
        const auctionsData = auctions.map((auction: any) => ({
            'Auction ID': auction.id,
            'Month': auction.month,
            'Date': formatDate(auction.date),
            'Winner': auction.winner.globalMember.name,
            'Amount': auction.amount,
            'Lowest Bid': auction.lowestBid || 'N/A',
            'Highest Bid': auction.highestBid || 'N/A',
            'Number of Bidders': auction.numberOfBidders || 'N/A',
            'Notes': auction.notes || 'N/A',
        }));

        // Create auctions sheet
        const auctionsSheet = XLSX.utils.json_to_sheet(auctionsData);
        XLSX.utils.book_append_sheet(wb, auctionsSheet, 'Auctions');

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Generate filename based on chit fund name and date
        const chitFundName = chitFund.name.replace(/[^a-zA-Z0-9]/g, '_');
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Set response headers for file download
        const headers = new Headers();
        const fileName = `${chitFundName}_${dateStr}.xlsx`;
        headers.append('Content-Disposition', `attachment; filename="${fileName}"`);
        headers.append('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        return new NextResponse(excelBuffer, {
            status: 200,
            headers: headers
        });
    } catch (error) {
        console.error('Error exporting chit fund details:', error);
        return NextResponse.json({ message: 'Error exporting chit fund details' }, { status: 500 });
    }
}

// Helper function to format date
function formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
