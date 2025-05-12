// Script to optimize API routes
const fs = require('fs');
const path = require('path');

// Paths
const appDir = path.join(__dirname, '..');
const apiDir = path.join(appDir, 'app', 'api');
const dashboardApiPath = path.join(apiDir, 'dashboard', 'route.ts');
const financialDataApiPath = path.join(apiDir, 'dashboard', 'financial-data', 'route.ts');

console.log('Starting API route optimization...');

// 1. Optimize dashboard API route
console.log('Optimizing dashboard API route...');
try {
  if (fs.existsSync(dashboardApiPath)) {
    let dashboardApi = fs.readFileSync(dashboardApiPath, 'utf8');

    // Remove the apiCache usage for now
    dashboardApi = dashboardApi.replace(
      /import { apiCache } from '@\/lib\/cache';/,
      '// import { apiCache } from \'@/lib/cache\';'
    );

    // Simplify the GET function
    dashboardApi = dashboardApi.replace(
      /export async function GET\(request: Request\)[^}]*const dashboardData = await apiCache\.getOrFetch\([^;]*;/s,
      `export async function GET(request: NextRequest) {
  try {
    // Get the current user ID for data isolation
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }`
    );

    // Replace the return statement
    dashboardApi = dashboardApi.replace(
      /return NextResponse\.json\(dashboardData\);/,
      `    // Get all aggregations in parallel for better performance
    const [
      contributionsSum,
      repaymentsSum,
      auctionsSum,
      loansSum,
      activeChitFunds,
      totalMembers,
      activeLoans,
      loansWithDetails,
      chitFundsWithDetails
    ] = await Promise.all([
      // Get total cash inflow from chit fund contributions
      prisma.contribution.aggregate({
        _sum: { amount: true },
        where: { chitFund: { createdById: currentUserId } }
      }),

      // Get total cash inflow from loan repayments
      prisma.repayment.aggregate({
        _sum: { amount: true },
        where: { loan: { createdById: currentUserId } }
      }),

      // Get total cash outflow from auctions
      prisma.auction.aggregate({
        _sum: { amount: true },
        where: { chitFund: { createdById: currentUserId } }
      }),

      // Get total cash outflow from loan disbursements
      prisma.loan.aggregate({
        _sum: { amount: true },
        where: { createdById: currentUserId }
      }),

      // Get active chit funds count
      prisma.chitFund.count({
        where: {
          status: 'Active',
          createdById: currentUserId
        }
      }),

      // Get total members count
      prisma.globalMember.count({
        where: { createdById: currentUserId }
      }),

      // Get active loans count
      prisma.loan.count({
        where: {
          status: 'Active',
          createdById: currentUserId
        }
      }),

      // Get loans with all necessary data for profit calculation
      prisma.loan.findMany({
        where: { createdById: currentUserId },
        include: {
          repayments: {
            select: {
              amount: true,
              paymentType: true,
            },
          },
        },
      }),

      // Get all chit funds with members, auctions, and contributions
      prisma.chitFund.findMany({
        where: { createdById: currentUserId },
        include: {
          members: true,
          auctions: true,
          contributions: true,
        },
      })
    ]);

    // Get recent activities and upcoming events in parallel
    const [recentActivities, upcomingEvents] = await Promise.all([
      getRecentActivities(prisma, currentUserId),
      getUpcomingEvents(prisma, currentUserId)
    ]);

    // Calculate loan profit using the centralized utility function
    const loanProfit = loansWithDetails.reduce((sum, loan) => {
      // Use the centralized utility function to calculate profit
      const profit = calculateLoanProfit(loan, loan.repayments);
      return sum + profit;
    }, 0);

    // Calculate chit fund profit and outside amount
    let chitFundProfit = 0;
    let totalOutsideAmount = 0;

    // Calculate profit and outside amount for each chit fund
    chitFundsWithDetails.forEach(fund => {
      const fundProfit = calculateChitFundProfit(fund, fund.contributions, fund.auctions);
      const fundOutsideAmount = calculateChitFundOutsideAmount(fund, fund.contributions, fund.auctions);

      chitFundProfit += fundProfit;
      totalOutsideAmount += fundOutsideAmount;
    });

    // Calculate remaining loan amount more efficiently
    const totalLoanAmount = loansWithDetails.reduce((sum, loan) => sum + loan.amount, 0);
    const totalRepaymentAmount = loansWithDetails.reduce((sum, loan) => {
      const loanRepayments = loan.repayments || [];
      return sum + loanRepayments.reduce((repaymentSum, repayment) => {
        if (repayment.paymentType !== 'interestOnly') {
          return repaymentSum + repayment.amount;
        }
        return repaymentSum;
      }, 0);
    }, 0);

    // Calculate the remaining loan amount
    const remainingLoanAmount = Math.max(0, totalLoanAmount - totalRepaymentAmount);

    // Add the remaining loan amount to the total outside amount
    const totalOutsideAmountWithLoans = totalOutsideAmount + remainingLoanAmount;

    // Create an object to store the breakdown of outside amount
    const outsideAmountBreakdown = {
      loanRemainingAmount: remainingLoanAmount,
      chitFundOutsideAmount: totalOutsideAmount
    };

    // Calculate total cash flows
    const totalCashInflow = (contributionsSum._sum.amount || 0) + (repaymentsSum._sum.amount || 0);
    const totalCashOutflow = (auctionsSum._sum.amount || 0) + (loansSum._sum.amount || 0);
    const totalProfit = loanProfit + chitFundProfit;

    return NextResponse.json({
      totalCashInflow,
      totalCashOutflow,
      totalProfit,
      loanProfit,
      chitFundProfit,
      totalOutsideAmount: totalOutsideAmountWithLoans,
      outsideAmountBreakdown,
      activeChitFunds,
      totalMembers,
      activeLoans,
      recentActivities,
      upcomingEvents,
    });`
    );

    fs.writeFileSync(dashboardApiPath, dashboardApi);
    console.log('Dashboard API route optimized successfully.');
  } else {
    console.log('Dashboard API route not found.');
  }
} catch (error) {
  console.error('Error optimizing dashboard API route:', error.message);
}

console.log('API route optimization completed successfully!');
