import { roundMoney } from './loanRecovery';

/**
 * Paying a contribution's outstanding balance.
 *
 * A member has one Contribution row per month. A later payment toward its balance tops that row
 * up (amount rises, balance falls) and the cash is recorded as its own ledger entry.
 */
export class BalancePaymentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface BalancePaymentPlan {
  /** Cash received in this payment. */
  amount: number;
  paidDate: Date;
  /** The contribution row's values after the payment. */
  newAmount: number;
  newBalance: number;
  balancePaymentStatus: string;
  actualBalancePaymentDate: Date | null;
}

const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/** Validates a balance payment against the contribution and returns the values to store. */
export function planBalancePayment(
  contribution: { amount: number; balance: number; balancePaymentStatus?: string | null; paidDate: Date | string },
  rawAmount: unknown,
  rawPaidDate: unknown
): BalancePaymentPlan {
  const outstanding = roundMoney(contribution.balance || 0);
  if (outstanding <= 0 || contribution.balancePaymentStatus === 'Paid') {
    throw new BalancePaymentError('This contribution has no pending balance', 409);
  }

  if ((typeof rawAmount !== 'string' && typeof rawAmount !== 'number') || String(rawAmount).trim() === '') {
    throw new BalancePaymentError('Amount is required');
  }
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount - roundMoney(amount)) > 0.000001) {
    throw new BalancePaymentError('Amount must be a positive number with at most two decimal places');
  }
  if (roundMoney(amount) > outstanding) {
    throw new BalancePaymentError(`Amount exceeds the pending balance of ${outstanding}`);
  }

  // Same parsing as recording a contribution: a YYYY-MM-DD string read as that calendar day.
  if (typeof rawPaidDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rawPaidDate)) {
    throw new BalancePaymentError('Paid date is required');
  }
  const paidDate = new Date(rawPaidDate);
  if (isNaN(paidDate.getTime()) || dayOf(paidDate) !== rawPaidDate) {
    throw new BalancePaymentError('Paid date is not a valid date');
  }
  if (rawPaidDate < dayOf(new Date(contribution.paidDate))) {
    throw new BalancePaymentError('Paid date cannot be before the original payment date');
  }

  const newBalance = roundMoney(outstanding - amount);
  const settled = newBalance === 0;
  return {
    amount: roundMoney(amount),
    paidDate,
    newAmount: roundMoney(contribution.amount + amount),
    newBalance,
    balancePaymentStatus: settled ? 'Paid' : contribution.balancePaymentStatus || 'Pending',
    actualBalancePaymentDate: settled ? paidDate : null,
  };
}
