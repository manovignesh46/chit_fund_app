// Run with: node tests/test-member-dues.js
// Members list search, per-member dues / payment history, and the shared dues builder.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

function load(file, mocks = {}, globals = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const context = {
    exports: {},
    console,
    ...globals,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(outputText, context);
  return context.exports;
}
const json = (v) => JSON.stringify(v);

const tracker = load("lib/duesTracker.ts", { "./monthlyAggregations": load("lib/monthlyAggregations.ts") });
const duesAccounts = load("lib/duesAccounts.ts", { "./duesTracker": tracker });

const now = new Date();
const monthsAgo = (n, day = now.getDate()) => new Date(now.getFullYear(), now.getMonth() - n, day);
const ravi = { id: 1, name: "Ravi", contact: "9876543210" };
const sita = { id: 2, name: "Sita", contact: "9000000000" };

const loans = [
  // Ravi: disbursed 3 months ago → installments 1..3 overdue/due, 1 paid
  { id: 11, createdById: 7, borrowerId: 1, loanType: "Monthly", repaymentType: "Monthly", installmentAmount: 1000, duration: 6,
    disbursementDate: monthsAgo(3, 1), borrower: ravi, repayments: [{ period: 1, amount: 1000, paidDate: monthsAgo(2, 1) }] },
  { id: 12, createdById: 7, borrowerId: 2, loanType: "Monthly", repaymentType: "Monthly", installmentAmount: 500, duration: 6,
    disbursementDate: monthsAgo(2, 1), borrower: sita, repayments: [] },
];
const chitFunds = [
  { id: 21, name: "Gold 1L", createdById: 7, startDate: monthsAgo(1, 1), duration: 10, monthlyContribution: 5000, firstMonthContribution: null,
    members: [
      { id: 31, globalMemberId: 1, globalMember: ravi, contributions: [{ month: 1, amount: 2000, paidDate: monthsAgo(1, 1), balancePaymentStatus: "Pending" }] },
      { id: 32, globalMemberId: 2, globalMember: sita, contributions: [] },
    ] },
];
const queries = [];
const fakeDb = {
  loan: { async findMany(q) { queries.push(["loan", q]); return loans.filter((l) => !q.where.borrowerId || l.borrowerId === q.where.borrowerId); } },
  chitFund: { async findMany(q) { queries.push(["chit", q]); return chitFunds; } },
};

(async () => {
  // ---- shared builder ----
  let r = await duesAccounts.buildDueAccounts(fakeDb, 7, { horizonDays: 0 });
  assert.equal(r.accounts.length, 4, "2 loans + 2 chit memberships");
  assert.equal(queries[0][1].where.createdById, 7);
  r = await duesAccounts.buildDueAccounts(fakeDb, 7, { horizonDays: 0, globalMemberId: 1 });
  assert.equal(json(r.accounts.map((a) => a.key).sort()), json(["chit-21-31", "loan-11"]));
  assert.ok(r.accounts.every((a) => a.globalMemberId === 1), "only Ravi's accounts");
  const loanAcct = r.accounts.find((a) => a.kind === "loan");
  assert.equal(json(loanAcct.periods.map((p) => p.period)), json([2, 3]));
  assert.equal(loanAcct.actionHref, "/loans/11/repayments/new");
  const chitAcct = r.accounts.find((a) => a.kind === "chit");
  assert.equal(chitAcct.periods[0].outstanding, 3000, "partial contribution leaves 3000");
  assert.equal(chitAcct.actionHref, "/chit-funds/21/contributions?month=1");
  assert.equal(r.summary.overdueMembers, 1);
  assert.equal(queries.at(-2)[1].where.borrowerId, 1);
  assert.equal(json(queries.at(-1)[1].include.members.where), json({ globalMemberId: 1 }));

  // ---- members route ----
  const members = [
    { id: 1, name: "Ravi Kumar", contact: "9876543210", createdById: 7 },
    { id: 2, name: "Sita", contact: "9000000000", createdById: 7 },
    { id: 3, name: "Other", contact: "1", createdById: 99 },
  ];
  let lastListQuery;
  const contributions = [
    { id: 1, amount: 2000, month: 1, paidDate: monthsAgo(1, 2), balance: 3000, notes: "part", chitFund: { id: 21, name: "Gold 1L" }, collectedBy: { name: "Arun" } },
  ];
  const repayments = [
    { id: 5, amount: 1000, period: 1, paidDate: monthsAgo(2, 1), paymentType: "full", loan: { id: 11, loanType: "Monthly", repaymentType: "Monthly" }, collectedBy: null },
    { id: 6, amount: 1000, period: 2, paidDate: monthsAgo(0, 1), paymentType: "interestOnly", loan: { id: 11, loanType: "Monthly", repaymentType: "Monthly" }, collectedBy: null },
  ];
  const historyQueries = [];
  const prisma = {
    globalMember: {
      async count({ where }) { lastListQuery = where; return 1; },
      async findMany({ where }) { lastListQuery = where; return [members[0]]; },
      async findUnique({ where }) { return members.find((m) => m.id === where.id) || null; },
    },
    contribution: {
      async findMany(q) { historyQueries.push(["c", q]); return q.where.chitFundId && q.where.chitFundId !== 21 ? [] : contributions; },
      async findFirst() { return { paidDate: contributions[0].paidDate, amount: 2000 }; },
    },
    repayment: {
      async findMany(q) { historyQueries.push(["r", q]); return repayments; },
      async findFirst() { return { paidDate: repayments[1].paidDate, amount: 1000 }; },
    },
    loan: fakeDb.loan,
    chitFund: fakeDb.chitFund,
  };
  const route = load("app/api/members/consolidated/route.ts", {
    "next/server": { NextResponse: { json: (body, o) => ({ body, status: o?.status ?? 200 }) } },
    "../../../../lib/prisma": { default: prisma, __esModule: true },
    "../../../../lib/auth": { getCurrentUserId: async () => 7, getActorUserId: async () => 7 },
    "../../../../lib/notifications": {},
    "../../../../lib/paymentSchedule": {},
    "../../../../lib/duesTracker": tracker,
    "../../../../lib/duesAccounts": duesAccounts,
  }, { URL });
  const get = (qs) => route.GET({ url: `http://x/api/members/consolidated?${qs}` });

  // search
  let res = await get("action=list&page=1&pageSize=10&search=%20ravi%20");
  assert.equal(res.status, 200);
  assert.equal(res.body.search, "ravi");
  assert.equal(lastListQuery.createdById, 7);
  assert.equal(json(lastListQuery.OR), json([{ name: { contains: "ravi", mode: "insensitive" } }, { contact: { contains: "ravi" } }]));
  await get("action=list&search=");
  assert.equal(lastListQuery.OR, undefined, "blank search returns everyone");
  assert.equal(lastListQuery.createdById, 7);
  await get(`action=list&search=${"x".repeat(150)}`);
  assert.equal(lastListQuery.OR[0].name.contains.length, 100);

  // dues
  res = await get("action=dues&id=1&horizonDays=30");
  assert.equal(res.status, 200);
  assert.ok(res.body.accounts.every((a) => a.globalMemberId === 1));
  assert.equal(res.body.lastPayment.amount, 1000, "latest of contribution/repayment");
  assert.equal((await get("action=dues&id=3")).status, 403);
  assert.equal((await get("action=dues&id=404")).status, 404);
  assert.equal((await get("action=dues")).status, 400);
  assert.equal((await get("action=dues&id=1&horizonDays=-1")).status, 400);

  // history
  res = await get("action=history&id=1&page=1&pageSize=2");
  assert.equal(res.status, 200);
  assert.equal(res.body.totalCount, 3);
  assert.equal(res.body.totalPages, 2);
  assert.equal(res.body.totalAmount, 4000);
  assert.equal(json(res.body.items.map((i) => i.key)), json(["r-6", "c-1"]), "newest first");
  assert.equal(res.body.items[0].detail, "Interest only");
  assert.equal(res.body.items[1].balance, 3000);
  assert.equal(historyQueries[0][1].where.chitFund.createdById, 7);
  assert.equal(historyQueries[1][1].where.loan.createdById, 7);
  res = await get("action=history&id=1&kind=contribution");
  assert.equal(json(res.body.items.map((i) => i.kind)), json(["contribution"]));
  res = await get("action=history&id=1&account=loan-11");
  assert.ok(res.body.items.every((i) => i.accountKey === "loan-11"));
  assert.equal((await get("action=history&id=3")).status, 403);

  console.log("PASS: member search, per-member dues and payment history, shared dues builder.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
