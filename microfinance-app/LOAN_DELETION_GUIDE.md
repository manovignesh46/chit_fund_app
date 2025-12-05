# Loan Deletion with Document Charge - Implementation Guide

## Overview

The loan deletion functionality has been updated to properly handle document charges and enforce business rules around loan deletion safety.

---

## Business Rules

### ✅ When a Loan CAN Be Deleted

A loan can only be deleted if:
1. **No repayments have been made** (no LOAN_REPAYMENT transactions exist)
2. **User has permission** (loan was created by the current user)

### ❌ When a Loan CANNOT Be Deleted

A loan deletion is blocked if:
1. **Any repayment transactions exist** (at least one LOAN_REPAYMENT found)
2. **User lacks permission** (loan created by different user)

**Rationale:** Once a loan has received payments, it represents a completed financial transaction that should be preserved for accounting integrity and audit trails.

---

## Deletion Process

### Step-by-Step Flow

```
1. Fetch loan with all related data
   ├─ Loan record
   ├─ Borrower information
   ├─ LOAN_DISBURSEMENT transaction
   ├─ DOCUMENT_CHARGE transaction (if exists)
   └─ All repayment records and transactions

2. Validate deletion eligibility
   ├─ Check loan exists ✓
   ├─ Check user permission ✓
   └─ Check for LOAN_REPAYMENT transactions ✓

3. If has repayments → STOP with error
   └─ Error: "Cannot delete loan: Loan has repayment transactions.
              Please delete all repayments first."

4. If no repayments → Proceed with deletion
   ├─ Find LOAN_DISBURSEMENT transaction
   ├─ Search for DOCUMENT_CHARGE transaction (same date, same amount, same borrower)
   └─ Collect transaction IDs to delete

5. Atomic deletion (all or nothing)
   ├─ Delete LOAN_DISBURSEMENT transaction
   ├─ Delete DOCUMENT_CHARGE transaction (if found)
   ├─ Delete payment schedules
   └─ Delete loan record

6. Recalculate balances
   └─ Update all subsequent transactions' balance fields
```

---

## What Gets Deleted

### Loan Without Document Charge
```
Before Deletion:
├─ Loan record (₹25,000)
├─ LOAN_DISBURSEMENT transaction (₹25,000)
└─ Payment schedules

After Deletion:
└─ (All removed) ✓
```

### Loan With Document Charge
```
Before Deletion:
├─ Loan record (₹30,000, doc charge: ₹1,000)
├─ LOAN_DISBURSEMENT transaction (₹29,000)
├─ DOCUMENT_CHARGE transaction (₹1,000)
└─ Payment schedules

After Deletion:
└─ (All removed) ✓
```

---

## Balance Impact

### Example: Deleting Loan with Document Charge

**Initial State:**
- Loan Amount: ₹30,000
- Document Charge: ₹1,000
- Actual Disbursement: ₹29,000
- Partner Balance Impact: -₹28,000 (net)

**Deletion Impact:**
```
Transaction Reversals:
├─ LOAN_DISBURSEMENT (₹29,000 debit) → Reversed
├─ DOCUMENT_CHARGE (₹1,000 credit) → Reversed
└─ Net balance restoration: +₹28,000
```

**Final State:**
- Partner Balance: Restored by +₹28,000
- All loan-related records: Deleted
- Transaction history: Cleaned up

---

## API Endpoint

### DELETE Request

```http
DELETE /api/loans/consolidated?action=delete&id={loanId}
Headers:
  x-active-partner: {partnerName}
```

### Success Response (No Repayments)

```json
{
  "message": "Loan deleted successfully"
}
```
**HTTP Status:** 200

### Error Response (Has Repayments)

```json
{
  "error": "Failed to delete loan: Cannot delete loan: Loan has repayment transactions. Please delete all repayments first."
}
```
**HTTP Status:** 500

### Error Response (Permission Denied)

```json
{
  "error": "Failed to delete loan: You do not have permission to delete this loan"
}
```
**HTTP Status:** 500

---

## Implementation Details

### File Modified
`app/api/loans/consolidated/route.ts` - `deleteLoan()` function

### Key Changes

1. **Added Repayment Check**
```typescript
const hasRepayments = existingLoan.repayments.some(
  repayment => repayment.transaction?.type === TRANSACTION_TYPES_CONFIG.LOAN_REPAYMENT
);

if (hasRepayments) {
  throw new Error("Cannot delete loan: Loan has repayment transactions. Please delete all repayments first.");
}
```

2. **Added Document Charge Search**
```typescript
if (existingLoan.transaction && existingLoan.documentCharge > 0) {
  documentChargeTransaction = await tx.transaction.findFirst({
    where: {
      type: TRANSACTION_TYPES_CONFIG.DOCUMENT_CHARGE,
      createdById: currentUserId,
      date: existingLoan.transaction.date,
      amount: existingLoan.documentCharge,
      note: { contains: existingLoan.borrower?.name || '' }
    }
  });
}
```

3. **Enhanced Transaction Collection**
- Collects both LOAN_DISBURSEMENT and DOCUMENT_CHARGE transactions
- Determines earliest transaction for balance recalculation
- Deletes both transactions atomically

---

## Testing Scenarios

### Test Case 1: Delete Loan Without Repayments ✅

**Setup:**
```javascript
Loan: ₹30,000
Document Charge: ₹1,000
Repayments: None
```

**Expected Result:**
- Deletion succeeds
- Both LOAN_DISBURSEMENT and DOCUMENT_CHARGE deleted
- Partner balance restored correctly
- Message: "Loan deleted successfully"

### Test Case 2: Delete Loan With Repayments ❌

**Setup:**
```javascript
Loan: ₹30,000
Document Charge: ₹1,000
Repayments: 1 payment of ₹5,000
```

**Expected Result:**
- Deletion blocked
- Error message shown
- No data deleted
- Message: "Cannot delete loan: Loan has repayment transactions..."

### Test Case 3: Delete Loan Without Document Charge ✅

**Setup:**
```javascript
Loan: ₹25,000
Document Charge: ₹0
Repayments: None
```

**Expected Result:**
- Deletion succeeds
- Only LOAN_DISBURSEMENT deleted (no doc charge exists)
- Partner balance restored correctly
- Message: "Loan deleted successfully"

---

## User Workflow

### Frontend Flow

1. **User clicks "Delete" on a loan**
   ```
   UI displays confirmation dialog:
   "Are you sure you want to delete this loan?"
   ```

2. **System sends DELETE request**
   ```
   DELETE /api/loans/consolidated?action=delete&id=123
   ```

3. **Response Handling**

   **If successful:**
   ```
   ✓ Show success message
   ✓ Refresh loan list
   ✓ Update partner balance display
   ```

   **If blocked (has repayments):**
   ```
   ✗ Show error message:
     "Cannot delete loan: Loan has repayment transactions.
      Please delete all repayments first."
   ✓ Keep loan in list
   ✓ Suggest action: Delete repayments first
   ```

---

## Safety Features

### 1. Atomic Transactions
- All deletions happen in a single database transaction
- If any step fails, nothing is deleted
- Ensures data consistency

### 2. Permission Checks
- Only loan creator can delete
- Prevents unauthorized deletions

### 3. Business Rule Enforcement
- Cannot delete loans with repayments
- Protects financial history integrity

### 4. Balance Recalculation
- Automatically recalculates all affected balances
- Maintains accurate financial state

### 5. Comprehensive Cleanup
- Deletes all related records
- No orphaned data left behind
- Includes payment schedules

---

## Database Impact

### Records Deleted
1. **Loan record** - Main loan entry
2. **LOAN_DISBURSEMENT transaction** - Disbursement record
3. **DOCUMENT_CHARGE transaction** - Document charge record (if exists)
4. **PaymentSchedule records** - All payment schedules for the loan

### Records NOT Deleted (When Blocked)
- **Repayment records** - Must be manually deleted first
- **LOAN_REPAYMENT transactions** - Must be manually deleted first

---

## Best Practices

### For Developers
1. Always check for repayments before allowing deletion UI
2. Show clear error messages to users
3. Consider adding a "soft delete" option for audit trails
4. Log deletion actions for compliance

### For Users
1. **Cannot delete loan with repayments** - Delete all repayments first
2. **Verify before deletion** - Action cannot be undone
3. **Check balances after deletion** - Ensure they're correct
4. **Maintain audit trail** - Consider exporting data before deletion

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Loan has repayment transactions" | Loan has received payments | Delete all repayments first |
| "Loan not found" | Invalid loan ID | Check loan exists |
| "Permission denied" | User didn't create loan | Use correct user account |
| "Transaction failed" | Database error | Retry or contact support |

---

## Future Enhancements

### Potential Improvements
1. **Soft Delete**: Mark as deleted instead of removing
2. **Cascade Delete**: Option to delete repayments automatically
3. **Deletion Log**: Track who deleted what and when
4. **Bulk Delete**: Delete multiple loans at once
5. **Restore Function**: Undo recent deletions

---

## Conclusion

The loan deletion functionality now properly:
- ✅ Enforces business rules (no deletion if repayments exist)
- ✅ Deletes both LOAN_DISBURSEMENT and DOCUMENT_CHARGE transactions
- ✅ Maintains accurate partner balances
- ✅ Provides clear error messages
- ✅ Ensures atomic operations for data integrity

**Test Script:** Run `node test-loan-deletion.js` to see examples of all scenarios.

---

**Implementation Date:** December 5, 2025  
**Status:** ✅ Complete
