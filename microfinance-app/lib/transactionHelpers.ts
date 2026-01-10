/**
 * Helper functions for transaction classification and balance management
 */

/**
 * Determine transaction class based on transaction type
 * @param type Transaction type (e.g., 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', etc.)
 * @param toPartnerId Partner receiving money
 * @param fromPartnerId Partner sending money
 * @returns 'CREDIT' | 'DEBIT' | 'TRANSFER'
 */
export function getTransactionClass(
  type: string,
  toPartnerId?: number | null,
  fromPartnerId?: number | null
): 'CREDIT' | 'DEBIT' | 'TRANSFER' {
  const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'DOCUMENT_CHARGE'];
  const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
  
  if (type === 'PARTNER_TO_PARTNER') return 'TRANSFER';
  if (creditTypes.includes(type)) return 'CREDIT';
  if (debitTypes.includes(type)) return 'DEBIT';
  
  // For RECORD_AMOUNT and others, determine by partner direction
  if (toPartnerId) return 'CREDIT';
  if (fromPartnerId) return 'DEBIT';
  
  return 'CREDIT'; // Default
}

/**
 * Get the partner ID for a transaction based on its type
 * @param type Transaction type
 * @param toPartnerId Partner receiving money
 * @param fromPartnerId Partner sending money
 * @returns partnerId
 */
export function getTransactionPartnerId(
  type: string,
  toPartnerId?: number | null,
  fromPartnerId?: number | null
): number | null {
  const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'DOCUMENT_CHARGE'];
  const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
  
  // For credit transactions, use toPartnerId
  if (creditTypes.includes(type)) {
    return toPartnerId || null;
  }
  
  // For debit transactions, use fromPartnerId
  if (debitTypes.includes(type)) {
    return fromPartnerId || null;
  }
  
  // For partner-to-partner transfers, prefer fromPartnerId (initiator)
  if (type === 'PARTNER_TO_PARTNER') {
    return fromPartnerId || toPartnerId || null;
  }
  
  // For RECORD_AMOUNT, use whichever is provided
  return toPartnerId || fromPartnerId || null;
}

/**
 * Calculate balance change for a transaction
 * @param transactionClass 'CREDIT' | 'DEBIT' | 'TRANSFER'
 * @param amount Transaction amount
 * @returns Balance change (positive for credit, negative for debit, zero for transfer)
 */
export function calculateBalanceChange(
  transactionClass: string,
  amount: number
): number {
  switch (transactionClass) {
    case 'CREDIT':
      return amount;
    case 'DEBIT':
      return -amount;
    case 'TRANSFER':
      return 0; // Transfers don't affect total balance
    default:
      return 0;
  }
}

/**
 * Format transaction class for display
 * @param transactionClass 'CREDIT' | 'DEBIT' | 'TRANSFER'
 * @returns User-friendly string
 */
export function formatTransactionClass(transactionClass: string): string {
  const map: Record<string, string> = {
    CREDIT: 'Credit',
    DEBIT: 'Debit',
    TRANSFER: 'Transfer'
  };
  return map[transactionClass] || transactionClass;
}
