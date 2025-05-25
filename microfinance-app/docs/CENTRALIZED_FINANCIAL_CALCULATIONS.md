# Centralized Financial Calculations System

## Overview

The Centralized Financial Calculations System provides a unified approach to calculating all financial metrics across the microfinance application. This system ensures consistency, prevents calculation discrepancies, and makes the codebase more maintainable.

## Benefits

- ✅ **Consistent Calculations**: Single source of truth for all financial logic
- ✅ **No More Discrepancies**: Eliminates mismatches between different views
- ✅ **Easy Maintenance**: Changes to calculation logic only need to be made in one place
- ✅ **Better Testing**: Centralized functions are easier to unit test
- ✅ **Type Safety**: Full TypeScript support with proper interfaces

## File Location

```
microfinance-app/lib/centralizedFinancialCalculations.ts
```

## Core Functions

### 1. `calculatePeriodFinancialMetrics()`

**Main function for period-specific calculations**

```typescript
const metrics = calculatePeriodFinancialMetrics(
  loansWithRepayments,
  chitFunds,
  loanDisbursements,
  periodRange,
  additionalCounts
);
```

**Returns**: Complete `FinancialMetrics` object with all financial data for the period.

### 2. `calculateTotalFinancialMetrics()`

**For overall/lifetime calculations**

```typescript
const totalMetrics = calculateTotalFinancialMetrics(
  loansWithRepayments,
  chitFunds
);
```

**Returns**: Total financial metrics across all time.

### 3. `calculateMultiPeriodFinancialMetrics()`

**For time-series data (charts)**

```typescript
const timeSeriesData = calculateMultiPeriodFinancialMetrics(periodsData);
```

**Returns**: Arrays of data for charts and detailed period information.

## Key Interfaces

### FinancialMetrics

```typescript
interface FinancialMetrics {
  // Core Metrics
  totalProfit: number;
  loanProfit: number;
  chitFundProfit: number;
  
  // Cash Flow
  totalCashInflow: number;
  totalCashOutflow: number;
  netCashFlow: number;
  
  // Detailed Cash Flow
  contributionInflow: number;
  repaymentInflow: number;
  auctionOutflow: number;
  loanOutflow: number;
  
  // Outside Amount
  totalOutsideAmount: number;
  loanRemainingAmount: number;
  chitFundOutsideAmount: number;
  
  // Profit Breakdown
  interestPayments: number;
  documentCharges: number;
  auctionCommissions: number;
  
  // Transaction Counts
  transactionCounts: TransactionCounts;
}
```

## Usage Examples

### Dashboard Summary

```typescript
// In API route
const totalMetrics = calculateTotalFinancialMetrics(
  loansWithRepayments, 
  chitFunds
);

return NextResponse.json({
  cashInflow: totalMetrics.totalCashInflow,
  cashOutflow: totalMetrics.totalCashOutflow,
  profit: {
    total: totalMetrics.totalProfit,
    loans: totalMetrics.loanProfit,
    chitFunds: totalMetrics.chitFundProfit
  },
  outsideAmount: totalMetrics.totalOutsideAmount
});
```

### Financial Details Popup

```typescript
// For period-specific data
const periodRange = createPeriodRange(startDate, endDate);
const metrics = calculatePeriodFinancialMetrics(
  periodLoansWithRepayments,
  periodChitFunds,
  periodLoanDisbursements,
  periodRange
);

return {
  profit: metrics.totalProfit,
  loanProfit: metrics.loanProfit,
  chitFundProfit: metrics.chitFundProfit,
  profitDetails: {
    interestPayments: metrics.interestPayments,
    documentCharges: metrics.documentCharges,
    auctionCommissions: metrics.auctionCommissions
  }
};
```

### Chart Data

```typescript
// For time-series charts
const chartData = calculateMultiPeriodFinancialMetrics(periodsData);

return {
  periods: chartData.periods,
  cashInflow: chartData.cashInflow,
  cashOutflow: chartData.cashOutflow,
  profit: chartData.profit,
  outsideAmount: chartData.outsideAmount
};
```

## Migration Guide

### Before (Manual Calculations)

```typescript
// ❌ OLD WAY - Manual calculations scattered across files
const loanProfit = loans.reduce((sum, loan) => {
  // Complex manual calculation logic
  return sum + calculatedProfit;
}, 0);

const chitFundProfit = chitFunds.reduce((sum, fund) => {
  // More manual calculation logic
  return sum + calculatedProfit;
}, 0);

const totalProfit = loanProfit + chitFundProfit;
```

### After (Centralized System)

```typescript
// ✅ NEW WAY - Use centralized system
const metrics = calculatePeriodFinancialMetrics(
  loansWithRepayments,
  chitFunds,
  loanDisbursements,
  periodRange
);

const totalProfit = metrics.totalProfit;
const loanProfit = metrics.loanProfit;
const chitFundProfit = metrics.chitFundProfit;
```

## Important Calculation Rules

### Document Charges

- **Period-Specific**: Only counted when loans are **disbursed** in that period
- **Total Calculations**: Included with the loan's total profit
- **No Double Counting**: Same document charge never appears in multiple periods

### Interest Payments

- **Monthly Loans**: `repayments.length × interestRate`
- **Weekly Loans**: `totalPaid - loanAmount` (if positive)
- **Period-Specific**: Only from repayments made in that period

### Cash Flow

- **Inflow**: Contributions + Repayments
- **Outflow**: Auctions + Loan Disbursements
- **Net**: Inflow - Outflow

### Outside Amount

- **Loan Remaining**: `loanOutflow - repaymentInflow` (if positive)
- **Chit Fund Outside**: `auctionOutflow - contributionInflow` (if positive)
- **Total**: Sum of both above

## Utility Functions

### Period Helpers

```typescript
// Create period range
const periodRange = createPeriodRange(startDate, endDate);

// Check if date is in period
const isInPeriod = isDateInPeriod(date, periodRange);

// Filter data for period
const periodData = filterDataForPeriod(data, periodRange, 'paidDate');
```

## Testing

The centralized system makes testing much easier:

```typescript
// Test period calculations
const testMetrics = calculatePeriodFinancialMetrics(
  mockLoans,
  mockChitFunds,
  mockDisbursements,
  testPeriodRange
);

expect(testMetrics.totalProfit).toBe(expectedProfit);
expect(testMetrics.documentCharges).toBe(expectedDocCharges);
```

## Backward Compatibility

The system maintains backward compatibility by re-exporting existing functions:

```typescript
// These still work for legacy code
export { 
  calculateLoanProfit,
  calculateChitFundProfit,
  calculateTotalLoanProfit,
  calculateTotalChitFundProfit
} from './financialUtils';
```

## Best Practices

1. **Always use centralized functions** for new financial calculations
2. **Migrate existing code** gradually to use the centralized system
3. **Test thoroughly** when migrating existing calculations
4. **Use TypeScript interfaces** to ensure type safety
5. **Document any custom logic** that deviates from standard calculations

## Troubleshooting

### Common Issues

1. **Profit Mismatch**: Ensure you're using the same data queries for both main calculations and detailed breakdowns
2. **Date Range Issues**: Use `createPeriodRange()` to ensure consistent date handling
3. **Missing Data**: Check that all required fields are included in database queries

### Debug Tips

```typescript
// Log metrics for debugging
console.log('Financial Metrics:', JSON.stringify(metrics, null, 2));

// Check individual components
console.log('Loan Profit:', metrics.loanProfit);
console.log('Interest:', metrics.interestPayments);
console.log('Document Charges:', metrics.documentCharges);
```

## Future Enhancements

- [ ] Add caching for frequently calculated metrics
- [ ] Implement real-time calculation updates
- [ ] Add more granular profit breakdowns
- [ ] Support for custom calculation rules per user
- [ ] Performance optimizations for large datasets

---

**Note**: This system was implemented to resolve profit calculation discrepancies and ensure consistent financial reporting across the entire application.
