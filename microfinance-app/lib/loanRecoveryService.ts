import { computeLoanDuePeriods, getLoanDueDate, summarizePeriods } from './duesTracker';
import { calculateTransactionBalance, getCurrentPartnerBalance, getCurrentTotalBalance } from './balanceCalculator';
import { NON_RECOVERABLE, RecoveryError, money, requiredReason, recoveryAllocation, roundMoney } from './loanRecovery';

// Running balances in this app follow entry order, including backdated receipts.
// Reversals remove the erroneous cash entry and replay the ledger atomically.
export async function replayBalances(tx: any, ownerId: number) {
  const transactions = await tx.transaction.findMany({ where: { createdById: ownerId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const balances = new Map<number, number>();
  let total = 0;
  for (const transaction of transactions) {
    const primary = transaction.to_partner_id || transaction.from_partner_id;
    const updated = calculateTransactionBalance(transaction, primary, balances.get(primary) || 0, total);
    for (const partnerId of new Set<number>([transaction.from_partner_id, transaction.to_partner_id].filter(Boolean))) {
      balances.set(partnerId, calculateTransactionBalance(transaction, partnerId, balances.get(partnerId) || 0, total).partnerBalance);
    }
    total = updated.totalBalance;
    // Entries before the removed receipt keep their balances; only write the rows that actually change.
    const partnerBalance = balances.get(primary) || 0;
    if (transaction.partnerBalance !== partnerBalance || transaction.totalBalance !== total) {
      await tx.transaction.update({ where: { id: transaction.id }, data: { partnerBalance, totalBalance: total } });
    }
  }
}

export function collectionPreview(loan: any, asOf = new Date()) {
  const end = new Date(asOf);
  end.setDate(end.getDate() + 30);
  const accounts = computeLoanDuePeriods({ ...loan, status: 'Active' }, { start: new Date(0), end }, asOf);
  const dueAtMark = computeLoanDuePeriods({ ...loan, status: 'Active' }, { start: new Date(0), end: asOf }, asOf);
  return { ...summarizePeriods(accounts), duesAtMark: summarizePeriods(dueAtMark).totalOutstanding, periods: accounts };
}

/** All state, audit, repayment and cash changes commit together. db is also injectable for integration tests. */
export async function changeLoanRecovery(db: any, context: {
  ownerId: number; actorId: number; linkedPartnerId: number | null; entryPartnerName: string;
}, loanId: number, body: any) {
  const { ownerId, actorId, linkedPartnerId, entryPartnerName } = context;
  const reason = requiredReason(body.reason);
  if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId)) {
    throw new RecoveryError('A valid request ID is required');
  }
  if (!['mark', 'collect', 'settle', 'restore', 'reverse'].includes(body.action)) throw new RecoveryError('Invalid recovery action');
  const requestSignature = JSON.stringify([body.action, reason, body.principal, body.interest, body.unpaidInterest, body.notes, body.paidDate, body.collectorId, body.repaymentId, body.confirmRestore, body.confirmSettlement]);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx: any) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('partner-balance'), ${ownerId}::integer)`;
        const loan = await tx.loan.findFirst({ where: { id: loanId, createdById: ownerId }, include: { repayments: true, borrower: true } });
        if (!loan) throw new RecoveryError('Loan not found', 404);
        const previous = await tx.loanRecoveryEvent.findUnique({ where: { loanId_requestId: { loanId, requestId: body.requestId } } });
        if (previous) {
          if (previous.action !== body.action || previous.details.requestSignature !== requestSignature) throw new RecoveryError('Request ID already used for another action or amount', 409);
          return { loan, event: previous };
        }
        if (body.expectedUpdatedAt && new Date(body.expectedUpdatedAt).getTime() !== new Date(loan.updatedAt).getTime()) {
          throw new RecoveryError('This loan changed. Refresh the page before trying again.', 409);
        }
        let changes: any = {};
        let details: any = {};
        let receipt: any;

        if (body.action === 'mark') {
          if (!['Active', 'Defaulted'].includes(loan.status) || loan.remainingAmount <= 0) {
            throw new RecoveryError('Only an active or defaulted loan with outstanding principal can be marked', 409);
          }
          const interest = money(body.unpaidInterest, 'Unpaid interest to track');
          const preview = collectionPreview(loan);
          if (body.notes != null && (typeof body.notes !== 'string' || body.notes.length > 4000)) throw new RecoveryError('Notes must be at most 4000 characters');
          changes = {
            status: NON_RECOVERABLE, nonRecoverableAt: new Date(), nonRecoverableReason: reason,
            nonRecoverableNotes: body.notes?.trim() || null,
            recoveryPrincipalAtMark: roundMoney(loan.remainingAmount), recoveryDuesAtMark: preview.duesAtMark,
            recoveryInterestOutstanding: interest, recoveryAmount: 0, recoveryOutcome: 'Open',
            overdueAmount: 0, missedPayments: 0, nextPaymentDate: null,
          };
          details = { previousStatus: loan.status, principal: loan.remainingAmount, unpaidInstallmentDues: preview.duesAtMark, unpaidInterest: interest, notes: changes.nonRecoverableNotes };
        } else {
          if (loan.status !== NON_RECOVERABLE) throw new RecoveryError('This loan is not marked Non-Recoverable', 409);
          if (loan.recoveryOutcome === 'Settled') throw new RecoveryError('This recovery case is already settled', 409);

          if (body.action === 'restore') {
            if (loan.remainingAmount <= 0) throw new RecoveryError('A loan without outstanding principal cannot be restored', 409);
            const preview = collectionPreview(loan);
            if (body.confirmRestore !== true) throw new RecoveryError('Confirm the collection preview before restoring');
            const futurePeriods = computeLoanDuePeriods({ ...loan, status: 'Active' }, {
              start: new Date(0), end: getLoanDueDate(loan.disbursementDate, loan.repaymentType, loan.duration),
            });
            changes = {
              status: 'Active', recoveryOutcome: 'Restored', overdueAmount: preview.overdueAmount,
              missedPayments: preview.overduePeriods,
              nextPaymentDate: futurePeriods.find((p) => p.status !== 'overdue')?.dueDate ?? null,
            };
            // The original schedule resumes. Recoveries are credited against it by computeLoanDuePeriods.
            details = { principal: loan.remainingAmount, trackedUnpaidInterest: loan.recoveryInterestOutstanding, collectionPreview: preview };
          } else {
            if (body.action === 'reverse') {
              const original = loan.repayments.find((r: any) => r.id === Number(body.repaymentId) && r.paymentType === 'RECOVERY');
              if (!original || new Date(original.createdAt) < new Date(loan.nonRecoverableAt)) throw new RecoveryError('Receipt not found in this recovery case', 404);
              const reversed = await tx.loanRecoveryEvent.findFirst({ where: { loanId, action: 'reverse', details: { path: ['reversedRepaymentId'], equals: original.id } } });
              if (reversed) throw new RecoveryError('This receipt was already reversed', 409);
              changes = {
                remainingAmount: roundMoney(loan.remainingAmount + (original.principalComponent || 0)),
                recoveryInterestOutstanding: roundMoney(loan.recoveryInterestOutstanding + (original.interestComponent || 0)),
                recoveryAmount: roundMoney(loan.recoveryAmount - original.amount), recoveryOutcome: 'Open',
              };
              details = { reversedRepaymentId: original.id, transactionId: original.transactionId,
                amountReversed: original.amount, principalReversed: original.principalComponent, interestReversed: original.interestComponent,
                originalPaidDate: new Date(original.paidDate).toISOString(), originalNotes: original.notes };
              await tx.repayment.delete({ where: { id: original.id } });
              if (original.transactionId) {
                await tx.transaction.delete({ where: { id: original.transactionId } });
                await replayBalances(tx, ownerId);
              }
            } else {
              const principal = money(body.principal, 'Principal received');
              const interest = money(body.interest, 'Interest received');
              if (principal + interest > 0) {
                const allocation = recoveryAllocation({ principal, interest }, loan);
                const paidDate = new Date(`${body.paidDate}T00:00:00+05:30`);
                const businessDay = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                if (typeof body.paidDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.paidDate) ||
                    isNaN(paidDate.getTime()) || businessDay(paidDate) !== body.paidDate ||
                    body.paidDate < businessDay(new Date(loan.nonRecoverableAt)) || body.paidDate > businessDay(new Date())) {
                  throw new RecoveryError('Payment date must be between the date marked and today');
                }
                const collectorId = Number(body.collectorId);
                if (!Number.isInteger(collectorId) || collectorId <= 0) throw new RecoveryError('Select a collector');
                if (linkedPartnerId && linkedPartnerId !== collectorId) throw new RecoveryError('Record recovery under your linked partner', 403);
                receipt = { ...allocation, collectorId, paidDate, paymentType: 'RECOVERY' };
                changes = {
                  remainingAmount: allocation.remainingAmount, recoveryInterestOutstanding: allocation.recoveryInterestOutstanding,
                  recoveryAmount: roundMoney(loan.recoveryAmount + allocation.amount), recoveryOutcome: allocation.recoveryOutcome,
                };
              } else if (body.action === 'collect') throw new RecoveryError('Enter an amount received');

              if (body.action === 'settle') {
                if (body.confirmSettlement !== true) throw new RecoveryError('Confirm the amounts waived before settling');
                details = {
                  principalWaived: roundMoney(changes.remainingAmount ?? loan.remainingAmount),
                  interestWaived: roundMoney(changes.recoveryInterestOutstanding ?? loan.recoveryInterestOutstanding),
                };
                changes = { ...changes, remainingAmount: 0, recoveryInterestOutstanding: 0, recoveryOutcome: 'Settled' };
              }
            }

            if (receipt) {
              const collector = await tx.partner.findFirst({ where: { id: receipt.collectorId, createdById: ownerId, ...(body.action !== 'reverse' ? { isActive: true } : {}) } });
              const entryPartner = await tx.partner.findFirst({ where: { createdById: ownerId, isActive: true, ...(linkedPartnerId ? { id: linkedPartnerId } : { name: entryPartnerName }) } });
              if (!collector || !entryPartner) throw new RecoveryError('Collector and data entry partner must belong to your business');
              const partnerBalance = await getCurrentPartnerBalance(collector.id, ownerId, undefined, tx);
              const totalBalance = await getCurrentTotalBalance(ownerId, undefined, tx);
              const balance = calculateTransactionBalance({ type: 'LOAN_REPAYMENT', amount: receipt.amount, to_partner_id: collector.id }, collector.id, partnerBalance, totalBalance);
              const transaction = await tx.transaction.create({
                data: {
                  type: 'LOAN_REPAYMENT', amount: receipt.amount, date: receipt.paidDate,
                  note: `${body.action === 'reverse' ? 'Recovery reversal' : 'Offline recovery'} · Loan #${loanId} · ${loan.borrower.name}: ${reason}`,
                  action_performer: collector.name, entered_by: entryPartner.name, createdById: ownerId,
                  to_partner_id: collector.id, ...balance,
                  repayment: { create: {
                    loanId, amount: receipt.amount, paidDate: receipt.paidDate, period: 0, paymentType: receipt.paymentType,
                    principalComponent: receipt.principal, interestComponent: receipt.interest, notes: reason,
                    collected_by_id: collector.id, entered_by_id: entryPartner.id, createdById: ownerId,
                  } },
                }, include: { repayment: true },
              });
              details = { ...details, repaymentId: transaction.repayment.id, transactionId: transaction.id, amountReceived: receipt.amount, principalReceived: receipt.principal, interestReceived: receipt.interest, collector: collector.name, paidDate: receipt.paidDate.toISOString() };
            }
            changes = { ...changes, nextPaymentDate: null, overdueAmount: 0, missedPayments: 0 };
          }
        }
        const updated = await tx.loan.update({ where: { id: loanId }, data: changes });
        const event = await tx.loanRecoveryEvent.create({ data: { loanId, actorId, action: body.action, reason, details: { ...details, requestSignature }, requestId: body.requestId } });
        return { loan: updated, event };
      }, { isolationLevel: 'Serializable', timeout: 15000 });
    } catch (error: any) {
      if ((error.code === 'P2034' || error.code === 'P2002') && attempt < 2) continue;
      throw error;
    }
  }
}
