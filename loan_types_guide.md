# Loan Types — Implementation Reference Guide

> Reference for building the loan module in a React + Node.js microfinance app.
> Covers interest calculation, repayment handling, and TypeScript utility code for each loan type.

---

## Overview

| Attribute | Monthly (Flat) | Weekly (Installment) | Reducing Balance |
|---|---|---|---|
| Interest basis | Fixed flat rate on principal | Built into installment amount | Charged on outstanding principal |
| Interest changes over time? | ❌ No | ❌ No | ✅ Yes (decreases) |
| Common tenure | Months | Weeks | Months |
| Borrower pays | Principal + interest separately | Fixed installment | EMI (principal + interest together) |
| Total interest burden | Higher (flat) | Fixed premium over principal | Lower (true interest) |

---

## 1. Monthly Loan (Flat Interest)

### Concept

The lender charges a **fixed interest amount** every month on the **original principal**, regardless of how much has been repaid. Interest does not reduce as the borrower pays down principal.

### Terminology

| Term | Description |
|---|---|
| `principal` | Original loan amount disbursed |
| `interestRate` | Fixed interest amount charged per month (in ₹, not %) |
| `tenure` | Number of months |
| `documentCharge` | One-time fee collected upfront |

### Interest Calculation

```
Monthly Interest = interestRate  (fixed ₹ amount, set at loan creation)

Total Interest = interestRate × tenure

Total Repayable = principal + Total Interest + documentCharge
```

> **Example:**
> Principal = ₹10,000 | Interest Rate = ₹500/month | Tenure = 6 months
>
> Monthly Interest = ₹500
> Total Interest = ₹500 × 6 = ₹3,000
> Total Repayable = ₹10,000 + ₹3,000 = ₹13,000

### Repayment Types

There are **two repayment modes** in this scheme:

#### a) Interest-Only Payment (`interestOnly`)
- Borrower pays only the monthly interest for that month.
- Principal remains unchanged.
- Used for early months when the borrower cannot afford to repay principal.

```
Payment Amount = interestRate
Principal Remaining = principal (unchanged)
```

#### b) Regular Payment (`regular`)
- Borrower pays interest + a portion of (or all of) the principal.
- Principal balance reduces.

```
Payment Amount = interestRate + principalComponent
Principal Remaining = principal - principalComponent
```

### Repayment Schedule Example

| Month | Payment Type | Amount Paid | Interest Component | Principal Component | Principal Balance |
|---|---|---|---|---|---|
| 1 | interestOnly | ₹500 | ₹500 | ₹0 | ₹10,000 |
| 2 | interestOnly | ₹500 | ₹500 | ₹0 | ₹10,000 |
| 3 | regular | ₹3,500 | ₹500 | ₹3,000 | ₹7,000 |
| 4 | regular | ₹3,500 | ₹500 | ₹3,000 | ₹4,000 |
| 5 | regular | ₹2,500 | ₹500 | ₹2,000 | ₹2,000 |
| 6 | regular | ₹2,500 | ₹500 | ₹2,000 | ₹0 |

### Profit Calculation (Lender's View)

```
Profit = (Number of payments × interestRate) + documentCharge
```

This is already implemented in your `calculateLoanProfit()`:
```ts
const interestOnlyProfit = interestOnlyPayments * loan.interestRate;
const regularPaymentsProfit = regularPayments * loan.interestRate;
const totalProfit = interestOnlyProfit + regularPaymentsProfit + documentCharge;
```

### Key Implementation Notes

- `interestRate` is stored as a **rupee amount per month**, NOT a percentage.
- Every repayment record (regardless of type) contributes exactly `interestRate` to profit.
- Track `paymentType: 'interestOnly' | 'regular'` on each repayment row.
- Loan is considered **closed** when `principalBalance === 0`.

---

## 2. Weekly Loan (Fixed Installment / Premium over Principal)

### Concept

The borrower repays a **fixed weekly installment** over a set number of weeks. The total amount collected is **more than the principal** — the difference is the lender's profit. There is no explicit "interest rate" line; the premium is baked into the installment structure.

### Terminology

| Term | Description |
|---|---|
| `principal` | Original loan amount disbursed |
| `installmentAmount` | Fixed weekly payment amount |
| `tenure` | Number of weeks |
| `totalRepayable` | `installmentAmount × tenure` |
| `premium` | `totalRepayable - principal` (lender's profit) |

### Interest / Premium Calculation

```
Total Repayable = installmentAmount × tenure
Premium (Profit) = Total Repayable - principal

Effective Interest Rate (annualized, informational) =
    (Premium / principal) × (52 / tenure) × 100
```

> **Example:**
> Principal = ₹10,000 | Installment = ₹450/week | Tenure = 26 weeks
>
> Total Repayable = ₹450 × 26 = ₹11,700
> Premium = ₹11,700 - ₹10,000 = ₹1,700

### Repayment Handling

- All weekly payments are **identical** — no distinction between interest and principal components.
- Payment is recorded with: `week number`, `amount paid`, `paid date`.
- Outstanding balance = `totalRepayable - totalPaid`

```
Outstanding = (installmentAmount × tenure) - sum(repayments)
```

### Repayment Schedule Example

| Week | Amount Due | Amount Paid | Total Paid | Outstanding |
|---|---|---|---|---|
| 1 | ₹450 | ₹450 | ₹450 | ₹11,250 |
| 2 | ₹450 | ₹450 | ₹900 | ₹10,800 |
| … | … | … | … | … |
| 26 | ₹450 | ₹450 | ₹11,700 | ₹0 |

### Profit Calculation (Lender's View)

```
Profit = totalPaid - principal   (only when totalPaid > principal)
```

From your existing implementation:
```ts
const totalPaid = repayments.reduce((sum, r) => sum + r.amount, 0);
const profit = totalPaid > loanAmount ? totalPaid - loanAmount : 0;
```

### Handling Partial / Missed Payments

| Scenario | Handling |
|---|---|
| Partial payment | Record actual amount; outstanding increases |
| Missed week | Record ₹0 or skip entry; outstanding carries over |
| Advance payment | Record extra; reduces future installment count |
| Prepayment (full) | Collect remaining outstanding; mark loan closed |

### Key Implementation Notes

- Store `installmentAmount` and `tenure` (weeks) at loan creation.
- Each repayment maps to a `weekNumber` (1 to N).
- No interest vs. principal split needed — treat every rupee as repayment toward outstanding.
- Loan is **closed** when `totalPaid >= totalRepayable`.
- `documentCharge` is **not** typically used here (profit is built into installment spread).

---

## 3. Reducing Balance Loan (Diminishing Balance / True Interest)

### Concept

Interest is calculated only on the **outstanding principal balance** each period. As principal decreases with each payment, the interest component of each EMI also decreases, while the principal component increases. This is the most financially fair scheme for the borrower.

### Terminology

| Term | Description |
|---|---|
| `principal` | Original loan amount disbursed |
| `annualInterestRate` | Annual interest rate (%) |
| `monthlyRate` | `annualInterestRate / 12 / 100` |
| `tenure` | Number of months |
| `EMI` | Fixed monthly payment (calculated once at loan start) |

### EMI Calculation Formula

```
monthlyRate (r) = annualInterestRate / 12 / 100

EMI = principal × r × (1 + r)^n
      ─────────────────────────
             (1 + r)^n − 1

Where n = tenure in months
```

> **Example:**
> Principal = ₹1,00,000 | Annual Rate = 12% | Tenure = 12 months
>
> r = 12 / 12 / 100 = 0.01
> EMI = 1,00,000 × 0.01 × (1.01)^12 / ((1.01)^12 - 1)
>     = 1,00,000 × 0.01 × 1.1268 / 0.1268
>     ≈ ₹8,885 per month

### Per-Period Interest & Principal Split

Each month, the EMI is **split** between interest and principal:

```
Interest for month N = outstandingPrincipal(N) × monthlyRate
Principal for month N = EMI - Interest(N)
outstandingPrincipal(N+1) = outstandingPrincipal(N) - Principal(N)
```

### Amortization Schedule Example

> Principal = ₹1,00,000 | Rate = 12% p.a. | EMI ≈ ₹8,885 | Tenure = 12 months

| Month | Opening Balance | EMI | Interest | Principal Paid | Closing Balance |
|---|---|---|---|---|---|
| 1 | ₹1,00,000 | ₹8,885 | ₹1,000 | ₹7,885 | ₹92,115 |
| 2 | ₹92,115 | ₹8,885 | ₹921 | ₹7,964 | ₹84,151 |
| 3 | ₹84,151 | ₹8,885 | ₹842 | ₹8,043 | ₹76,108 |
| … | … | … | … | … | … |
| 12 | ₹8,797 | ₹8,885 | ₹88 | ₹8,797 | ₹0 |

**Key observation:** Interest component _decreases_ every month. Principal component _increases_ every month. EMI stays _constant_.

### Profit Calculation (Lender's View)

```
Total Interest Collected = sum of all interest components across all months
                         = (EMI × n) - principal
```

From your existing implementation:
```ts
let currentPrincipal = loan.amount;
const monthlyRate = loan.interestPercentage / 100 / 12;

sortedRepayments.forEach(repayment => {
  const interest = currentPrincipal * monthlyRate;
  const principalPaid = repayment.amount - interest;
  totalInterestProfit += interest;
  currentPrincipal = Math.max(0, currentPrincipal - principalPaid);
});
```

### Handling Prepayments / Foreclosure

| Scenario | Handling |
|---|---|
| Extra principal payment | Reduce outstanding; recalculate remaining EMIs or reduce tenure |
| Foreclosure | Collect outstanding principal + any applicable prepayment charge |
| Missed EMI | Add to outstanding; charge penalty interest on overdue amount |

### Key Implementation Notes

- Store `interestPercentage` (annual %) at loan creation — NOT a fixed ₹ amount.
- The EMI is **computed at disbursement** and stored on the loan record.
- Each repayment must record both the split (`interestComponent`, `principalComponent`) OR recompute from outstanding principal at record time.
- Loan is **closed** when `outstandingPrincipal ≈ 0` (handle floating point with a threshold like `< 1`).
- `documentCharge` is added to lender's profit on top of interest.

---

## TypeScript Utility Functions (for New App)

```typescript
// ─── Shared Types ─────────────────────────────────────────────────────────────

export type RepaymentType = 'Monthly' | 'Weekly' | 'ReducingBalance';

export interface MonthlyLoan {
  principal: number;
  interestRate: number;      // Fixed ₹ amount per month
  tenure: number;            // months
  documentCharge?: number;
}

export interface WeeklyLoan {
  principal: number;
  installmentAmount: number; // Fixed ₹ per week
  tenure: number;            // weeks
}

export interface ReducingBalanceLoan {
  principal: number;
  annualInterestRate: number; // percentage e.g. 12 for 12%
  tenure: number;             // months
  documentCharge?: number;
}

// ─── Monthly Loan ─────────────────────────────────────────────────────────────

export function calcMonthlyLoanSchedule(loan: MonthlyLoan) {
  const { principal, interestRate, tenure } = loan;
  return {
    monthlyInterest: interestRate,
    totalInterest: interestRate * tenure,
    totalRepayable: principal + interestRate * tenure,
  };
}

// ─── Weekly Loan ──────────────────────────────────────────────────────────────

export function calcWeeklyLoanSchedule(loan: WeeklyLoan) {
  const { principal, installmentAmount, tenure } = loan;
  const totalRepayable = installmentAmount * tenure;
  return {
    totalRepayable,
    premium: totalRepayable - principal,
    weeklyInstallment: installmentAmount,
  };
}

export function calcWeeklyOutstanding(loan: WeeklyLoan, totalPaid: number) {
  return Math.max(0, loan.installmentAmount * loan.tenure - totalPaid);
}

// ─── Reducing Balance ─────────────────────────────────────────────────────────

export function calcEMI(principal: number, annualRate: number, tenureMonths: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (principal * r * factor) / (factor - 1);
}

export interface AmortizationRow {
  month: number;
  openingBalance: number;
  emi: number;
  interest: number;
  principalPaid: number;
  closingBalance: number;
}

export function generateAmortizationSchedule(loan: ReducingBalanceLoan): AmortizationRow[] {
  const { principal, annualInterestRate, tenure } = loan;
  const r = annualInterestRate / 100 / 12;
  const emi = calcEMI(principal, annualInterestRate, tenure);
  const schedule: AmortizationRow[] = [];

  let balance = principal;
  for (let month = 1; month <= tenure; month++) {
    const interest = balance * r;
    const principalPaid = emi - interest;
    const closingBalance = Math.max(0, balance - principalPaid);

    schedule.push({
      month,
      openingBalance: parseFloat(balance.toFixed(2)),
      emi: parseFloat(emi.toFixed(2)),
      interest: parseFloat(interest.toFixed(2)),
      principalPaid: parseFloat(principalPaid.toFixed(2)),
      closingBalance: parseFloat(closingBalance.toFixed(2)),
    });

    balance = closingBalance;
  }
  return schedule;
}

export function calcReducingBalanceTotalInterest(loan: ReducingBalanceLoan): number {
  const emi = calcEMI(loan.principal, loan.annualInterestRate, loan.tenure);
  return parseFloat((emi * loan.tenure - loan.principal).toFixed(2));
}
```

---

## Database Schema Recommendation (Prisma-style)

```prisma
model Loan {
  id              Int      @id @default(autoincrement())
  memberId        Int
  repaymentType   String   // "Monthly" | "Weekly" | "ReducingBalance"

  // Common
  principal       Float
  documentCharge  Float    @default(0)
  tenure          Int      // months or weeks depending on type
  disbursedAt     DateTime @default(now())
  status          String   @default("Active") // Active | Closed | Defaulted

  // Monthly
  interestRate    Float?   // Fixed ₹ per month

  // Weekly
  installmentAmount Float? // Fixed ₹ per week

  // Reducing Balance
  annualInterestRate Float? // Annual % e.g. 12
  emi               Float? // Pre-calculated EMI

  repayments      Repayment[]
}

model Repayment {
  id              Int      @id @default(autoincrement())
  loanId          Int
  loan            Loan     @relation(fields: [loanId], references: [id])
  period          Int      // month or week number
  paidDate        DateTime
  amount          Float    // Total amount paid this period

  // For Monthly loans
  paymentType     String?  // "interestOnly" | "regular"

  // For Reducing Balance loans (pre-computed at time of payment)
  interestComponent   Float?
  principalComponent  Float?
}
```

---

## Loan Type Decision Guide

```
Is the repayment cycle weekly?
  └─ YES → Weekly Loan
  └─ NO  → Is interest charged on remaining principal?
              └─ YES → Reducing Balance
              └─ NO  → Monthly (Flat Interest)
```

---

## Implementation Checklist for New React + Node.js App

### Backend (Node.js / Express)
- [ ] `POST /loans` — Create loan, calculate & store EMI (for Reducing Balance) or validate installmentAmount (for Weekly)
- [ ] `GET /loans/:id/schedule` — Return full repayment schedule / amortization table
- [ ] `POST /loans/:id/repayments` — Record a payment; update outstanding balance
- [ ] `GET /loans/:id/outstanding` — Calculate remaining balance in real-time
- [ ] `GET /loans/:id/profit` — Lender's profit from this loan to date
- [ ] Loan closure logic — auto-close when outstanding ≈ 0

### Frontend (React)
- [ ] Loan creation form — show/hide fields based on selected `repaymentType`
- [ ] Amortization schedule table (Reducing Balance) with month-by-month breakdown
- [ ] Weekly payment tracker — week grid showing paid/unpaid weeks
- [ ] Monthly repayment list — with interestOnly vs regular badges
- [ ] Outstanding balance widget per loan
- [ ] Profit summary card per loan and aggregate
