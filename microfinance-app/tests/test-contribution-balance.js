// node tests/test-contribution-balance.js [--integration]
// Paying a chit contribution's pending balance: validation, stored values, ledger entries and deletion.
// Integration mode exclusively targets the disposable local PostgreSQL instance below (the same one
// tests/test-loan-recovery.js uses). It never uses the application DATABASE_URL.
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', jsx: 'react-jsx' });
const integration = process.argv.includes('--integration');
if (integration) process.env.DATABASE_URL = `postgresql://${encodeURIComponent(require('node:os').userInfo().username)}@localhost:55439/chit_recovery?host=/tmp/chit-recovery-pg-socket`;
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { planBalancePayment, BalancePaymentError } = require('../lib/contributionBalance');

const partial = { amount: 2000, balance: 3800, balancePaymentStatus: 'Pending', paidDate: new Date('2026-08-14') };
const rejects = (contribution, amount, paidDate, status, message) => assert.throws(
  () => planBalancePayment(contribution, amount, paidDate),
  (error) => error instanceof BalancePaymentError && error.status === status && message.test(error.message)
);

test('a full balance payment settles the contribution', () => {
  const plan = planBalancePayment(partial, 3800, '2026-11-06');
  assert.equal(plan.amount, 3800);
  assert.equal(plan.newAmount, 5800);
  assert.equal(plan.newBalance, 0);
  assert.equal(plan.balancePaymentStatus, 'Paid');
  assert.equal(plan.actualBalancePaymentDate.toISOString(), '2026-11-06T00:00:00.000Z');
  assert.equal(plan.paidDate.toISOString(), '2026-11-06T00:00:00.000Z');
});

test('a part payment reduces the balance and keeps it pending', () => {
  const plan = planBalancePayment(partial, '1000.50', '2026-09-01');
  assert.equal(plan.amount, 1000.5);
  assert.equal(plan.newAmount, 3000.5);
  assert.equal(plan.newBalance, 2799.5);
  assert.equal(plan.balancePaymentStatus, 'Pending');
  assert.equal(plan.actualBalancePaymentDate, null);
  assert.equal(planBalancePayment({ ...partial, balancePaymentStatus: 'Overdue' }, 100, '2026-09-01').balancePaymentStatus, 'Overdue');
  assert.equal(planBalancePayment({ ...partial, balancePaymentStatus: null }, 100, '2026-09-01').balancePaymentStatus, 'Pending');
  // Paying on the same day as the original payment is allowed.
  assert.equal(planBalancePayment(partial, 100, '2026-08-14').newBalance, 3700);
});

test('invalid balance payments are rejected', () => {
  rejects(partial, 3800.01, '2026-11-06', 400, /exceeds the pending balance of 3800/);
  rejects(partial, 0, '2026-11-06', 400, /positive number/);
  rejects(partial, -5, '2026-11-06', 400, /positive number/);
  rejects(partial, 10.999, '2026-11-06', 400, /two decimal places/);
  rejects(partial, 'abc', '2026-11-06', 400, /positive number/);
  rejects(partial, '', '2026-11-06', 400, /Amount is required/);
  rejects(partial, undefined, '2026-11-06', 400, /Amount is required/);
  rejects(partial, 100, '', 400, /Paid date is required/);
  rejects(partial, 100, '06-11-2026', 400, /Paid date is required/);
  rejects(partial, 100, '2026-02-30', 400, /not a valid date/);
  rejects(partial, 100, '2026-08-13', 400, /before the original payment date/);
  rejects({ ...partial, balance: 0 }, 100, '2026-11-06', 409, /no pending balance/);
  rejects({ ...partial, balancePaymentStatus: 'Paid' }, 100, '2026-11-06', 409, /no pending balance/);
});

if (integration) test('database workflow: part and full balance payments, ledger entries, running balances and deletion', async () => {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  const { randomUUID } = require('node:crypto');
  try {
    const owner = await db.user.create({ data: { name: 'Balance test owner', email: `balance-${randomUUID()}@test.invalid`, password: 'unused', role: 'admin' } });
    const other = await db.user.create({ data: { name: 'Other owner', email: `balance-other-${randomUUID()}@test.invalid`, password: 'unused' } });
    await db.partner.create({ data: { name: 'Me', createdById: owner.id } });
    const person = await db.globalMember.create({ data: { name: 'Balance Member', contact: '9000000001', createdById: owner.id } });
    const fund = await db.chitFund.create({ data: { name: 'Balance Fund', totalAmount: 58000, monthlyContribution: 5800, duration: 10, membersCount: 10, startDate: new Date('2026-05-01'), createdById: owner.id } });
    const member = await db.member.create({ data: { globalMemberId: person.id, chitFundId: fund.id, contribution: 5800 } });

    const Module = require('node:module');
    const originalLoad = Module._load;
    let authOwner = owner.id;
    let route;
    try {
      Module._load = function(request, parent, isMain) {
        if (request.endsWith('/lib/auth')) return { getCurrentUserId: async () => authOwner, getActorUserId: async () => owner.id };
        return originalLoad.call(this, request, parent, isMain);
      };
      route = require('../app/api/chit-funds/consolidated/route');
    } finally { Module._load = originalLoad; }

    const call = (method, action, body) => route[method](new Request(`http://localhost/api/chit-funds/consolidated?action=${action}&id=${fund.id}`, {
      method, headers: { 'Content-Type': 'application/json', 'x-active-partner': 'Me' }, body: JSON.stringify(body),
    }));
    const ledger = () => db.transaction.findMany({ where: { createdById: owner.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const row = (id) => db.contribution.findUnique({ where: { id } });

    // An unrelated earlier entry, so running balances have something to carry forward.
    assert.equal((await call('POST', 'add-contribution', { memberId: member.id, month: 3, amount: 5800, paidDate: '2026-07-10' })).status, 201);
    // Month 4 is part paid: 2,000 of 5,800.
    const created = await call('POST', 'add-contribution', { memberId: member.id, month: 4, amount: 2000, paidDate: '2026-08-14' });
    assert.equal(created.status, 201);
    const contribution = await created.json();
    assert.equal(contribution.balance, 3800); assert.equal(contribution.balancePaymentStatus, 'Pending');
    const original = (await ledger()).at(-1);
    assert.equal(original.totalBalance, 7800);

    // A second contribution row for the same month is still refused; the balance is paid through the new action.
    assert.equal((await call('POST', 'add-contribution', { memberId: member.id, month: 4, amount: 3800, paidDate: '2026-11-06' })).status, 400);

    // Rejections change nothing.
    assert.equal((await call('POST', 'pay-contribution-balance', { contributionId: contribution.id, amount: 3800.01, paidDate: '2026-11-06' })).status, 400);
    assert.equal((await call('POST', 'pay-contribution-balance', { contributionId: contribution.id, amount: 100, paidDate: '2026-08-01' })).status, 400);
    assert.equal((await call('POST', 'pay-contribution-balance', { amount: 100, paidDate: '2026-11-06' })).status, 400);
    assert.equal((await call('POST', 'pay-contribution-balance', { contributionId: 99999999, amount: 100, paidDate: '2026-11-06' })).status, 404);
    authOwner = other.id;
    assert.equal((await call('POST', 'pay-contribution-balance', { contributionId: contribution.id, amount: 100, paidDate: '2026-11-06' })).status, 403);
    authOwner = owner.id;
    assert.equal((await ledger()).length, 2);
    assert.equal((await row(contribution.id)).balance, 3800);

    // Part payment: 1,000 on 1 Oct.
    const part = await call('POST', 'pay-contribution-balance', { contributionId: contribution.id, amount: 1000, paidDate: '2026-10-01' });
    assert.equal(part.status, 200);
    const afterPart = await part.json();
    assert.equal(afterPart.amount, 3000); assert.equal(afterPart.balance, 2800);
    assert.equal(afterPart.balancePaymentStatus, 'Pending'); assert.equal(afterPart.actualBalancePaymentDate, null);
    assert.equal(afterPart.member.globalMember.name, 'Balance Member');

    // Two requests for the remaining 2,800 at once: only one may succeed.
    const race = await Promise.all([1, 2].map(() => call('POST', 'pay-contribution-balance', { contributionId: contribution.id, amount: 2800, paidDate: '2026-11-06' })));
    assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
    const settled = await row(contribution.id);
    assert.equal(settled.amount, 5800); assert.equal(settled.balance, 0);
    assert.equal(settled.balancePaymentStatus, 'Paid');
    assert.equal(settled.actualBalancePaymentDate.toISOString(), '2026-11-06T00:00:00.000Z');
    assert.equal(settled.paidDate.toISOString(), '2026-08-14T00:00:00.000Z', 'original payment date is kept');
    assert.equal((await call('POST', 'pay-contribution-balance', { contributionId: contribution.id, amount: 1, paidDate: '2026-11-06' })).status, 409);

    // Ledger: the original entry is untouched and each balance payment has its own entry.
    const entries = await ledger();
    assert.equal(entries.length, 4);
    const unchanged = entries.find(e => e.id === original.id);
    assert.equal(unchanged.amount, 2000); assert.equal(unchanged.totalBalance, 7800);
    assert.equal(unchanged.date.toISOString(), '2026-08-14T00:00:00.000Z'); assert.equal(unchanged.balanceContributionId, null);
    const payments = entries.filter(e => e.balanceContributionId === contribution.id);
    assert.deepEqual(payments.map(e => [e.type, e.amount, e.date.toISOString().slice(0, 10), e.totalBalance, e.partnerBalance]),
      [['CHIT_CONTRIBUTION', 1000, '2026-10-01', 8800, 8800], ['CHIT_CONTRIBUTION', 2800, '2026-11-06', 11600, 11600]]);
    assert.match(payments[0].note, /^Chit contribution from Balance Member - Balance Fund Month 4 \(balance payment\)$/);
    assert.equal(await db.contribution.count({ where: { chitFundId: fund.id, memberId: member.id, month: 4 } }), 1, 'still one row for the month');

    // The contributions listing carries the status fields the month view needs.
    const listing = await (await route.GET(new Request(`http://localhost/api/chit-funds/consolidated?action=contributions&id=${fund.id}`))).json();
    const listed = listing.allContributions.find(c => c.id === contribution.id);
    assert.equal(listed.balancePaymentStatus, 'Paid'); assert.equal(listed.amount, 5800);

    // Deleting the contribution removes its original entry and both balance entries, and restores the running balance.
    assert.equal((await call('DELETE', 'delete-contribution', { contributionId: contribution.id })).status, 200);
    const remaining = await ledger();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].totalBalance, 5800); assert.equal(remaining[0].partnerBalance, 5800);
    assert.equal(await row(contribution.id), null);

    // A contribution with no balance payments is deleted exactly as before.
    const month3 = await db.contribution.findFirst({ where: { chitFundId: fund.id, month: 3 } });
    assert.equal((await call('DELETE', 'delete-contribution', { contributionId: month3.id })).status, 200);
    assert.equal((await ledger()).length, 0);
  } finally { await db.$disconnect(); }
});
