# Document Charge Flow Diagram

## Loan Creation with Document Charge

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOAN CREATION                               │
│                                                                     │
│  Input:                                                             │
│  ├─ Loan Amount: ₹30,000                                           │
│  ├─ Document Charge: ₹1,000                                        │
│  └─ Borrower: John Doe                                             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CALCULATION                                    │
│                                                                     │
│  Actual Disbursement = Loan Amount - Document Charge               │
│  Actual Disbursement = ₹30,000 - ₹1,000 = ₹29,000                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  DATABASE TRANSACTION (Atomic)                      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ Transaction 1: LOAN_DISBURSEMENT                          │    │
│  │ ────────────────────────────────────────────────────────  │    │
│  │ Type: LOAN_DISBURSEMENT                                   │    │
│  │ Amount: ₹29,000  (actual cash given to member)           │    │
│  │ From Partner: Partner1                                    │    │
│  │ To Partner: null                                          │    │
│  │ Note: "Loan disbursed to John Doe"                        │    │
│  │ Partner Balance Change: -₹29,000 (Debit)                 │    │
│  │                                                            │    │
│  │ Creates Loan Record:                                       │    │
│  │   ├─ Amount: ₹30,000                                      │    │
│  │   ├─ Document Charge: ₹1,000                              │    │
│  │   └─ Borrower: John Doe                                   │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ Transaction 2: DOCUMENT_CHARGE (if charge > 0)            │    │
│  │ ────────────────────────────────────────────────────────  │    │
│  │ Type: DOCUMENT_CHARGE                                     │    │
│  │ Amount: ₹1,000  (income/fee)                              │    │
│  │ From Partner: null                                        │    │
│  │ To Partner: Partner1                                      │    │
│  │ Note: "Document charge for loan to John Doe"              │    │
│  │ Partner Balance Change: +₹1,000 (Credit)                 │    │
│  └───────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PARTNER BALANCE UPDATE                          │
│                                                                     │
│  Initial Balance:        ₹100,000                                  │
│  After Disbursement:     ₹100,000 - ₹29,000 = ₹71,000            │
│  After Doc Charge:       ₹71,000 + ₹1,000 = ₹72,000              │
│  ─────────────────────────────────────────────────────────────     │
│  NET CHANGE:             -₹28,000                                  │
│  FINAL BALANCE:          ₹72,000                                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TRANSACTION LIST DISPLAY                         │
│                                                                     │
│  Date         Type                 Amount    Partner    Cr/Dr      │
│  ────────────────────────────────────────────────────────────────  │
│  2025-12-05   LOAN_DISBURSEMENT   ₹29,000   Partner1   Debit      │
│  2025-12-05   DOCUMENT_CHARGE      ₹1,000   Partner1   Credit     │
└─────────────────────────────────────────────────────────────────────┘
```

## Comparison: Before vs After

### ❌ BEFORE (Wrong)
```
Loan: ₹30,000 with ₹1,000 document charge

Transaction Created:
┌──────────────────────────────────────┐
│ LOAN_DISBURSEMENT                    │
│ Amount: ₹30,000                      │
│ Partner Balance: -₹30,000            │
└──────────────────────────────────────┘

Actual Cash Flow:
├─ Cash given to member: ₹29,000
├─ Document charge kept: ₹1,000
└─ Partner balance: -₹30,000 ❌ WRONG!
```

### ✅ AFTER (Correct)
```
Loan: ₹30,000 with ₹1,000 document charge

Transactions Created:
┌──────────────────────────────────────┐
│ 1. LOAN_DISBURSEMENT                 │
│    Amount: ₹29,000                   │
│    Partner Balance: -₹29,000         │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ 2. DOCUMENT_CHARGE                   │
│    Amount: ₹1,000                    │
│    Partner Balance: +₹1,000          │
└──────────────────────────────────────┘

Actual Cash Flow:
├─ Cash given to member: ₹29,000 ✅
├─ Document charge income: ₹1,000 ✅
└─ Net partner balance: -₹28,000 ✅ CORRECT!
```

## Benefits Summary

### 📊 Accurate Accounting
- Partner balance correctly reflects actual cash flow
- Separates principal disbursement from income

### 💰 Income Tracking
- Document charges tracked as separate income stream
- Easy to filter and analyze document charge revenue
- Better profit analysis

### 🔍 Audit Trail
- Clear transaction history
- Each financial event has its own record
- Transparent accounting

### 📈 Reporting
- Can generate reports specifically for document charge income
- Better financial insights
- Compliance-ready documentation
