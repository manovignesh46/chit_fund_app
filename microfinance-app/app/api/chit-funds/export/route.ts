import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { apiCache } from '@/lib/cache';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function POST(request: NextRequest) {
    try {
        // Get chit fund IDs from request body
        const { chitFundIds } = await request.json();

        if (!chitFundIds || !Array.isArray(chitFundIds) || chitFundIds.length === 0) {
            return NextResponse.json({ message: 'No chit fund IDs provided' }, { status: 400 });
        }

        // Convert string IDs to numbers if needed
        const numericChitFundIds = chitFundIds.map(id => typeof id === 'string' ? parseInt(id, 10) : id);

        // Fetch all selected chit funds with their members
        const chitFunds = await prismaAny.chitFund.findMany({
            where: {
                id: { in: numericChitFundIds }
            },
            include: {
                members: {
                    include: {
                        globalMember: true,
                    }
                },
                _count: {
                    select: {
                        contributions: true,
                        auctions: true
                    }
                }
            }
        });

        if (!chitFunds || chitFunds.length === 0) {
            return NextResponse.json({ message: 'No chit funds found' }, { status: 404 });
        }

        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Process each chit fund to calculate financial data for summary
        const summaryData = await Promise.all(chitFunds.map(async (chitFund: any) => {
            // Calculate end date
            const startDate = new Date(chitFund.startDate);
            const endDate = new Date(startDate);
            endDate.setMonth(startDate.getMonth() + chitFund.duration);

            // Fetch contributions for this chit fund
            const contributions = await prismaAny.contribution.findMany({
                where: { chitFundId: chitFund.id }
            });

            // Fetch auctions for this chit fund
            const auctions = await prismaAny.auction.findMany({
                where: { chitFundId: chitFund.id }
            });

            // Calculate financial summary
            let totalInflow = 0;
            let totalOutflow = 0;
            let totalProfit = 0;
            let outsideAmount = 0;

            // Calculate cash inflow from contributions
            if (contributions && contributions.length > 0) {
                totalInflow = contributions.reduce((sum: number, contribution: any) => sum + contribution.amount, 0);
            }

            // Calculate cash outflow from auctions
            if (auctions && auctions.length > 0) {
                totalOutflow = auctions.reduce((sum: number, auction: any) => sum + auction.amount, 0);

                // Calculate profit from auctions
                auctions.forEach((auction: any) => {
                    const monthlyTotal = chitFund.monthlyContribution * chitFund.members.length;
                    const auctionProfit = monthlyTotal - auction.amount;
                    totalProfit += auctionProfit > 0 ? auctionProfit : 0;
                });
            }

            // If there are no auctions or the calculated profit is 0, but there's a difference between inflow and outflow,
            // use that difference as the profit
            if ((auctions.length === 0 || totalProfit === 0) && totalInflow > totalOutflow) {
                totalProfit = totalInflow - totalOutflow;
            }

            // Calculate outside amount (when outflow exceeds inflow)
            if (totalOutflow > totalInflow) {
                outsideAmount = totalOutflow - totalInflow;
            }

            return {
                'Chit Fund ID': chitFund.id,
                'Name': chitFund.name,
                'Total Amount': chitFund.totalAmount,
                'Monthly Contribution': chitFund.monthlyContribution,
                'Duration (months)': chitFund.duration,
                'Members Count': chitFund.membersCount,
                'Current Members': chitFund.members.length,
                'Status': chitFund.status,
                'Start Date': formatDate(chitFund.startDate),
                'End Date': formatDate(endDate),
                'Current Month': chitFund.currentMonth,
                'Contributions Count': chitFund._count.contributions,
                'Auctions Count': chitFund._count.auctions,
                'Total Cash Inflow': totalInflow,
                'Total Cash Outflow': totalOutflow,
                'Total Profit': totalProfit,
                'Outside Amount': outsideAmount
            };
        }));

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Chit Funds Summary');

        // For each chit fund, create a detailed sheet
        for (const chitFund of chitFunds) {
            // Fetch contributions for this chit fund
            const contributions = await prismaAny.contribution.findMany({
                where: { chitFundId: chitFund.id },
                include: {
                    member: {
                        include: {
                            globalMember: true
                        }
                    }
                },
                orderBy: [
                    { month: 'asc' },
                    { paidDate: 'asc' }
                ],
                take: 100 // Limit to 100 most recent contributions to avoid excessive data
            });

            // Fetch auctions for this chit fund
            const auctions = await prismaAny.auction.findMany({
                where: { chitFundId: chitFund.id },
                include: {
                    winner: {
                        include: {
                            globalMember: true
                        }
                    }
                },
                orderBy: { month: 'asc' }
            });

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

            // Format chit fund details
            const chitFundDetails = {
                'Chit Fund ID': chitFund.id,
                'Name': chitFund.name,
                'Total Amount': chitFund.totalAmount,
                'Monthly Contribution': chitFund.monthlyContribution,
                'Duration (months)': chitFund.duration,
                'Members Count': chitFund.membersCount,
                'Status': chitFund.status,
                'Start Date': formatDate(chitFund.startDate),
                'Current Month': chitFund.currentMonth,
                'Total Cash Inflow': totalInflow,
                'Total Cash Outflow': totalOutflow,
                'Total Profit': totalProfit,
                'Outstanding Balance': totalBalance,
                'Outside Amount': outsideAmount,
            };

            // Format members data
            const membersData = chitFund.members.map((member: any) => ({
                'Member ID': member.id,
                'Name': member.globalMember.name,
                'Contact': member.globalMember.contact,
                'Monthly Contribution': member.contribution,
                'Auction Won': member.auctionWon ? 'Yes' : 'No',
                'Auction Month': member.auctionMonth || 'N/A',
            }));

            // Format contributions data
            const contributionsData = contributions.map((contribution: any) => ({
                'Month': contribution.month,
                'Member': contribution.member.globalMember.name,
                'Amount': contribution.amount,
                'Paid Date': formatDate(contribution.paidDate),
                'Balance': contribution.balance,
                'Balance Status': contribution.balancePaymentStatus || 'N/A',
            }));

            // Format auctions data
            const auctionsData = auctions.map((auction: any) => ({
                'Month': auction.month,
                'Date': formatDate(auction.date),
                'Winner': auction.winner.globalMember.name,
                'Amount': auction.amount,
            }));

            // Create a sheet for this chit fund
            const chitFundSheet = XLSX.utils.json_to_sheet([
                chitFundDetails,
                { 'Chit Fund ID': '' }, // Empty row for spacing
                { 'Chit Fund ID': 'MEMBERS' }, // Header for members section
                ...membersData,
                { 'Chit Fund ID': '' }, // Empty row for spacing
                { 'Chit Fund ID': 'CONTRIBUTIONS' }, // Header for contributions section
                ...contributionsData,
                { 'Chit Fund ID': '' }, // Empty row for spacing
                { 'Chit Fund ID': 'AUCTIONS' }, // Header for auctions section
                ...auctionsData,
            ]);

            // Add the sheet to the workbook
            XLSX.utils.book_append_sheet(wb, chitFundSheet, `ChitFund ${chitFund.id} - ${chitFund.name.substring(0, 15)}`);
        }

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Format current date for filename
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Set response headers for file download
        const headers = new Headers();
        const fileName = `ChitFund_Details_${dateStr}.xlsx`;
        headers.append('Content-Disposition', `attachment; filename="${fileName}"`);
        headers.append('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        return new NextResponse(excelBuffer, {
            status: 200,
            headers: headers
        });
    } catch (error) {
        console.error('Error exporting chit funds:', error);
        return NextResponse.json({ message: 'Error exporting chit funds' }, { status: 500 });
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
