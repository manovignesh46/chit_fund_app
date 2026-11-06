// node tests/test-loan-recovery.js [--integration]
// Integration mode exclusively targets the disposable local PostgreSQL instance below.
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', jsx: 'react-jsx' });
const integration = process.argv.includes('--integration');
if (integration) process.env.DATABASE_URL = `postgresql://${encodeURIComponent(require('node:os').userInfo().username)}@localhost:55439/chit_recovery?host=/tmp/chit-recovery-pg-socket`;
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { money, recoveryAllocation } = require('../lib/loanRecovery');
const { computeLoanDuePeriods } = require('../lib/duesTracker');
const { calculateLoanProfit } = require('../lib/financialUtils');
const { calculatePeriodFinancialMetrics, calculateTotalFinancialMetrics } = require('../lib/centralizedFinancialCalculations');

test('recovery allocations validate amounts and preserve principal/interest separation', () => {
  for (const invalid of ['', null, undefined, true, -1, NaN, Infinity, '12x', 0.001]) assert.throws(() => money(invalid, 'Amount'));
  assert.equal(money('12.34', 'Amount'), 12.34);
  const loan = { remainingAmount: 30000, recoveryInterestOutstanding: 5000 };
  assert.throws(() => recoveryAllocation({ principal: 30001, interest: 0 }, loan));
  assert.throws(() => recoveryAllocation({ principal: 0, interest: 5001 }, loan));
  assert.throws(() => recoveryAllocation({ principal: 0, interest: 0 }, loan));
  assert.equal(recoveryAllocation({ principal: 10000, interest: 0 }, loan).remainingAmount, 20000);
  assert.equal(recoveryAllocation({ principal: 30000, interest: 5000 }, loan).recoveryOutcome, 'Recovered');
});

test('all loan types exclude Non-Recoverable dues; restoration credits recovery once across date ranges', () => {
  for (const repaymentType of ['Monthly', 'Weekly', 'Reducing Balance']) {
    const loan = { status: 'Non-Recoverable', disbursementDate: new Date('2026-01-01'), duration: 12, repaymentType,
      loanType: repaymentType, installmentAmount: 1000, remainingAmount: 10000, repayments: [] };
    const range = { start: new Date('2026-01-01'), end: new Date('2026-12-31') };
    assert.deepEqual(computeLoanDuePeriods(loan, range), []);
    const restored = { ...loan, status: 'Active', repayments: [{ period: 0, amount: 1500, paymentType: 'RECOVERY', paidDate: new Date('2026-01-02') }] };
    const periods = computeLoanDuePeriods(restored, range);
    assert.equal(periods[0].period, 2);
    assert.equal(periods[0].outstanding, 500);
    const laterRange = { start: new Date(periods[1].dueDate), end: range.end };
    assert.equal(computeLoanDuePeriods(restored, laterRange)[0].outstanding, 1000, 'credit is consumed before range filtering');
  }
});

test('offline principal is cash recovery; only allocated interest contributes to profit for every loan type', () => {
  for (const type of ['Monthly', 'Weekly', 'Reducing Balance']) {
    const repayments = [{ id: 1, period: 0, amount: 2500, principalComponent: 2000, interestComponent: 500, paymentType: 'RECOVERY', paidDate: new Date('2026-10-10') }];
    const loan = { id: 1, loanType: type, repaymentType: type, amount: 10000, interestRate: 800, interestPercentage: 12,
      documentCharge: 100, disbursementDate: new Date('2026-09-01'), remainingAmount: 8000, repayments };
    assert.equal(calculateLoanProfit(loan, repayments), 600, type);
    const total = calculateTotalFinancialMetrics([loan], []);
    assert.equal(total.repaymentInflow, 2500);
    assert.equal(total.interestPayments, 500);
    const period = calculatePeriodFinancialMetrics([loan], [], [], { startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31') });
    assert.equal(period.loanProfit, 500);
    assert.equal(period.repaymentInflow, 2500);
  }
});

if (integration) test('database workflow: tenant isolation, snapshots, cash, retries, reversals, settlement, restoration and concurrent receipts', async () => {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  const { changeLoanRecovery } = require('../lib/loanRecoveryService');
  const { buildDueAccounts } = require('../lib/duesAccounts');
  const { randomUUID } = require('node:crypto');
  try {
    const owner = await db.user.create({ data: { name: 'Recovery test owner', email: `recovery-${randomUUID()}@test.invalid`, password: 'unused', role: 'admin' } });
    const other = await db.user.create({ data: { name: 'Other owner', email: `other-${randomUUID()}@test.invalid`, password: 'unused' } });
    const collector = await db.partner.create({ data: { name: 'Me', createdById: owner.id } });
    const outsider = await db.partner.create({ data: { name: 'Other partner', createdById: other.id } });
    const member = await db.globalMember.create({ data: { name: 'Test Borrower', contact: '9000000000', createdById: owner.id } });
    const disbursementDate = new Date(); disbursementDate.setMonth(disbursementDate.getMonth() - 3); disbursementDate.setDate(1);
    const makeLoan = () => db.loan.create({ data: { borrowerId: member.id, createdById: owner.id, amount: 10000,
      remainingAmount: 10000, interestRate: 500, loanType: 'Monthly', repaymentType: 'Monthly', installmentAmount: 2500,
      disbursementDate, duration: 6 } });
    const context = { ownerId: owner.id, actorId: owner.id, linkedPartnerId: null, entryPartnerName: 'Me' };
    const action = (id, body, ctx = context) => changeLoanRecovery(db, ctx, id, { reason: 'Test recovery action', requestId: randomUUID(), ...body });
    const loan = await makeLoan();
    const marked = await action(loan.id, { action: 'mark', unpaidInterest: 1000 });
    assert.equal(marked.loan.status, 'Non-Recoverable');
    assert.equal(marked.loan.recoveryPrincipalAtMark, 10000);
    assert.ok(marked.loan.recoveryDuesAtMark > 0);
    assert.equal(marked.loan.nextPaymentDate, null);
    assert.equal(marked.loan.overdueAmount, 0);
    assert.equal(await db.transaction.count({ where: { createdById: owner.id } }), 0, 'marking creates no cash receipt');
    assert.equal((await buildDueAccounts(db, owner.id)).accounts.length, 0);
    await assert.rejects(() => action(loan.id, { action: 'mark', unpaidInterest: 0 }), e => e.status === 409);
    await assert.rejects(() => action(loan.id, { action: 'collect', principal: 100, interest: 0, collectorId: outsider.id, paidDate: new Date().toISOString().slice(0, 10) }), e => e.status === 400);
    await assert.rejects(() => action(loan.id, { action: 'collect', principal: 100, interest: 0 }, { ...context, ownerId: other.id }), e => e.status === 404);
    const receiptBody = { action: 'collect', principal: 2000, interest: 500, paidDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), collectorId: collector.id, requestId: randomUUID() };
    const receipt = await action(loan.id, receiptBody);
    assert.equal(receipt.loan.remainingAmount, 8000);
    assert.equal(receipt.loan.recoveryInterestOutstanding, 500);
    assert.equal(receipt.loan.recoveryAmount, 2500);
    await action(loan.id, receiptBody);
    assert.equal(await db.repayment.count({ where: { loanId: loan.id } }), 1, 'retry cannot double collect');
    await assert.rejects(() => action(loan.id, { ...receiptBody, principal: 3000 }), e => e.status === 409);
    let cash = await db.transaction.findUnique({ where: { id: receipt.event.details.transactionId } });
    assert.equal(cash.amount, 2500); assert.equal(cash.partnerBalance, 2500); assert.equal(cash.totalBalance, 2500);
    const corrected = await action(loan.id, { action: 'reverse', repaymentId: receipt.event.details.repaymentId });
    assert.equal(corrected.loan.remainingAmount, 10000); assert.equal(corrected.loan.recoveryInterestOutstanding, 1000);
    assert.equal(await db.transaction.count({ where: { createdById: owner.id } }), 0); assert.equal(await db.repayment.count({ where: { loanId: loan.id } }), 0);
    assert.equal(await db.loanRecoveryEvent.count({ where: { loanId: loan.id } }), 3, 'original receipt and reversal audit survive');
    await assert.rejects(() => action(loan.id, { action: 'reverse', repaymentId: receipt.event.details.repaymentId }), e => e.status === 404 || e.status === 409);

    const collected = await action(loan.id, { ...receiptBody, requestId: randomUUID() });
    await action(loan.id, { action: 'restore', confirmRestore: true });
    const accounts = await buildDueAccounts(db, owner.id);
    assert.equal(accounts.accounts.length, 1);
    assert.equal(accounts.accounts[0].periods[0].period, 2, 'first installment credited on restoring');
    await action(loan.id, { action: 'mark', unpaidInterest: 500 });
    await assert.rejects(() => action(loan.id, { action: 'reverse', repaymentId: collected.event.details.repaymentId }), e => e.status === 404);
    await assert.rejects(() => action(loan.id, { action: 'settle', principal: 1000, interest: 0, collectorId: collector.id, paidDate: receiptBody.paidDate }), e => e.status === 400);
    const beforeSettlement = await db.transaction.count({ where: { createdById: owner.id } });
    const settled = await action(loan.id, { action: 'settle', principal: 1000, interest: 100, collectorId: collector.id, paidDate: receiptBody.paidDate, confirmSettlement: true });
    assert.equal(settled.loan.recoveryOutcome, 'Settled'); assert.equal(settled.loan.remainingAmount, 0);
    assert.equal(settled.event.details.principalWaived, 7000); assert.equal(settled.event.details.interestWaived, 400);
    assert.equal(await db.transaction.count({ where: { createdById: owner.id } }), beforeSettlement + 1);
    await assert.rejects(() => action(loan.id, { action: 'restore', confirmRestore: true }), e => e.status === 409);

    const concurrent = await makeLoan();
    await action(concurrent.id, { action: 'mark', unpaidInterest: 0 });
    const race = await Promise.allSettled([1, 2].map(() => action(concurrent.id, { ...receiptBody, principal: 8000, interest: 0, requestId: randomUUID() })));
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await db.loan.findUnique({ where: { id: concurrent.id } })).remainingAmount, 2000);
    const recovered = await action(concurrent.id, { ...receiptBody, principal: 2000, interest: 0, requestId: randomUUID() });
    assert.equal(recovered.loan.recoveryOutcome, 'Recovered'); assert.equal(recovered.loan.status, 'Non-Recoverable');

    // Exercise route auth and ordinary mutation guards against the real disposable database.
    const Module = require('node:module');
    const originalLoad = Module._load;
    let authOwner = owner.id;
    let routes;
    try {
      Module._load = function(request, parent, isMain) {
        if (request.endsWith('/lib/auth')) return { getCurrentUserId: async () => authOwner, getActorUserId: async () => owner.id, getLinkedPartnerId: async () => null };
        return originalLoad.call(this, request, parent, isMain);
      };
      routes = { recovery: require('../app/api/loans/[id]/recovery/route'), loans: require('../app/api/loans/consolidated/route') };
    } finally { Module._load = originalLoad; }
    const req = body => new Request('http://localhost/api/loans/x/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-active-partner': 'Me' }, body: JSON.stringify(body) });
    const params = id => ({ params: Promise.resolve({ id: String(id) }) });
    assert.equal((await routes.recovery.GET(new Request('http://localhost'), params(loan.id))).status, 200);
    authOwner = null;
    assert.equal((await routes.recovery.GET(new Request('http://localhost'), params(loan.id))).status, 401);
    assert.equal((await routes.recovery.POST(req({}), params(loan.id))).status, 401);
    authOwner = other.id;
    assert.equal((await routes.recovery.GET(new Request('http://localhost'), params(loan.id))).status, 404);
    authOwner = owner.id;
    assert.equal((await routes.recovery.GET(new Request('http://localhost'), params('bad'))).status, 400);
    const ordinary = new Request(`http://localhost/api/loans/consolidated?action=add-repayment&id=${concurrent.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-active-partner': 'Me' },
      body: JSON.stringify({ amount: 100, paidDate: new Date(), paymentType: 'REGULAR', scheduleId: 1, collected_by: collector.id }),
    });
    assert.equal((await routes.loans.POST(ordinary)).status, 409, 'ordinary receipt cannot reactivate the case');
    const edit = new Request(`http://localhost/api/loans/consolidated?action=update&id=${concurrent.id}`, { method: 'PUT', body: JSON.stringify({ status: 'Active' }) });
    assert.equal((await routes.loans.PUT(edit)).status, 409);

    // Ordinary receipts/deletion still work, and share the same lock as marking.
    const routine = await makeLoan();
    const before = await db.transaction.findFirst({ where: { createdById: owner.id }, orderBy: { createdAt: 'desc' } });
    const ordinaryRequest = () => new Request(`http://localhost/api/loans/consolidated?action=add-repayment&id=${routine.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-active-partner': 'Me' },
      body: JSON.stringify({ amount: 2500, paidDate: new Date(), paymentType: 'REGULAR', scheduleId: 1, collected_by: collector.id }),
    });
    assert.equal((await routes.loans.POST(ordinaryRequest())).status, 201);
    const ordinaryReceipt = await db.repayment.findFirst({ where: { loanId: routine.id } });
    assert.equal((await db.loan.findUnique({ where: { id: routine.id } })).remainingAmount, 8000);
    const remove = new Request(`http://localhost/api/loans/consolidated?action=delete-repayment&id=${routine.id}`, {
      method: 'DELETE', body: JSON.stringify({ repaymentId: ordinaryReceipt.id }),
    });
    assert.equal((await routes.loans.DELETE(remove)).status, 200);
    assert.equal((await db.loan.findUnique({ where: { id: routine.id } })).remainingAmount, 10000);
    const after = await db.transaction.findFirst({ where: { createdById: owner.id }, orderBy: { createdAt: 'desc' } });
    assert.equal(after.totalBalance, before.totalBalance);

    // Loans without recovery history keep the long-standing overdue rule: a repayment recorded
    // against a period settles it, so an interest-only receipt leaves only periods 2 and 3 overdue.
    const interestOnly = await makeLoan();
    const interestOnlyRequest = new Request(`http://localhost/api/loans/consolidated?action=add-repayment&id=${interestOnly.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-active-partner': 'Me' },
      body: JSON.stringify({ amount: 500, paidDate: new Date(), paymentType: 'INTEREST_ONLY', scheduleId: 1, collected_by: collector.id }),
    });
    assert.equal((await routes.loans.POST(interestOnlyRequest)).status, 201);
    const afterInterestOnly = await db.loan.findUnique({ where: { id: interestOnly.id } });
    assert.equal(afterInterestOnly.overdueAmount, 5000); assert.equal(afterInterestOnly.missedPayments, 2);
    const interestOnlyReceipt = await db.repayment.findFirst({ where: { loanId: interestOnly.id } });
    const removeInterestOnly = new Request(`http://localhost/api/loans/consolidated?action=delete-repayment&id=${interestOnly.id}`, {
      method: 'DELETE', body: JSON.stringify({ repaymentId: interestOnlyReceipt.id }),
    });
    assert.equal((await routes.loans.DELETE(removeInterestOnly)).status, 200);
    const afterRemoval = await db.loan.findUnique({ where: { id: interestOnly.id } });
    assert.equal(afterRemoval.overdueAmount, 7500); assert.equal(afterRemoval.missedPayments, 3);
    const latest = await db.transaction.findFirst({ where: { createdById: owner.id }, orderBy: { createdAt: 'desc' } });
    assert.equal(latest.totalBalance, before.totalBalance);
  } finally { await db.$disconnect(); }
});
