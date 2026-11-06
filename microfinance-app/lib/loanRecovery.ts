/** Recovery receipts use period 0: they are cash received outside the installment schedule. */
export const NON_RECOVERABLE = 'Non-Recoverable';

export class RecoveryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function money(value: unknown, label: string): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw new RecoveryError(`${label} is required`);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12 || Math.abs(amount - roundMoney(amount)) > 0.000001) {
    throw new RecoveryError(`${label} must be a non-negative amount with at most two decimal places`);
  }
  return roundMoney(amount);
}

export function requiredReason(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000) {
    throw new RecoveryError('A reason of 1–2000 characters is required');
  }
  return value.trim();
}

export function recoveryAllocation(body: { principal: unknown; interest: unknown }, loan: {
  remainingAmount: number; recoveryInterestOutstanding: number;
}) {
  const principal = money(body.principal, 'Principal received');
  const interest = money(body.interest, 'Interest received');
  if (principal + interest <= 0) throw new RecoveryError('Enter an amount received');
  if (principal > roundMoney(loan.remainingAmount)) throw new RecoveryError('Principal received exceeds the remaining principal');
  if (interest > roundMoney(loan.recoveryInterestOutstanding)) throw new RecoveryError('Interest received exceeds the tracked unpaid interest');
  const remainingAmount = roundMoney(loan.remainingAmount - principal);
  const recoveryInterestOutstanding = roundMoney(loan.recoveryInterestOutstanding - interest);
  return {
    principal, interest, amount: roundMoney(principal + interest), remainingAmount, recoveryInterestOutstanding,
    recoveryOutcome: remainingAmount === 0 && recoveryInterestOutstanding === 0 ? 'Recovered' : 'Open',
  };
}

