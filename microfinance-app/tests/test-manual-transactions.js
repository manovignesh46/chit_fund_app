// Run with: node tests/test-manual-transactions.js
// Covers mandatory audit notes and input validation for partner transfers / record amount,
// plus the dues calculations shared by the pending modals and the Dues Tracker.
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

const v = load("lib/transactionValidation.ts");
const now = new Date("2026-10-30T10:00:00Z");
const transfer = { type: "PARTNER_TO_PARTNER", amount: "5000", date: "2026-10-30", note: "Cash handover", from_partner_id: "1", to_partner_id: "2" };

// Happy paths
let r = v.validateManualTransaction(transfer, now);
assert.equal(r.ok, true);
assert.equal(r.value.amount, 5000);
assert.equal(r.value.fromPartnerId, 1);
assert.equal(r.value.toPartnerId, 2);
r = v.validateManualTransaction({ ...transfer, note: "  Cash   handover\n after collection " }, now);
assert.equal(r.value.note, "Cash handover after collection");
r = v.validateManualTransaction({ type: "RECORD_AMOUNT", amount: 1200.5, date: "2026-10-01", note: "Opening balance", from_partner_id: null, to_partner_id: 3 }, now);
assert.equal(r.ok, true);
assert.equal(r.value.fromPartnerId, null);

// Note is mandatory for both manual types
for (const type of ["PARTNER_TO_PARTNER", "RECORD_AMOUNT"]) {
  const base = type === "RECORD_AMOUNT" ? { ...transfer, type, from_partner_id: null } : transfer;
  for (const note of [undefined, null, "", "   ", "abc", 42, "x".repeat(501)]) {
    r = v.validateManualTransaction({ ...base, note }, now);
    assert.equal(r.ok, false, `${type} note ${JSON.stringify(note)} should fail`);
    assert.ok(r.errors.note);
  }
}

// Amount
for (const amount of ["", "abc", "-5", "0", 0, -1, NaN, Infinity, "1e5", "10.555", 10.555, "1,000", 200000000]) {
  r = v.validateManualTransaction({ ...transfer, amount }, now);
  assert.equal(r.ok, false, `amount ${amount} should fail`);
  assert.ok(r.errors.amount);
}
assert.equal(v.validateManualTransaction({ ...transfer, amount: "10.55" }, now).ok, true);

// Date
for (const date of ["", "not-a-date", undefined, "2026-11-05"]) {
  r = v.validateManualTransaction({ ...transfer, date }, now);
  assert.equal(r.ok, false, `date ${date} should fail`);
  assert.ok(r.errors.date);
}

// Partners
assert.ok(v.validateManualTransaction({ ...transfer, from_partner_id: "" }, now).errors.from_partner_id);
assert.ok(v.validateManualTransaction({ ...transfer, to_partner_id: null }, now).errors.to_partner_id);
assert.ok(v.validateManualTransaction({ ...transfer, to_partner_id: "1" }, now).errors.to_partner_id);
assert.ok(v.validateManualTransaction({ ...transfer, from_partner_id: "1.5" }, now).errors.from_partner_id);
const rec = { ...transfer, type: "RECORD_AMOUNT" };
assert.equal(v.validateManualTransaction(rec, now).ok, false, "record amount cannot touch two partners");
assert.equal(v.validateManualTransaction({ ...rec, from_partner_id: null, to_partner_id: null }, now).ok, false);
assert.equal(v.validateManualTransaction({ ...rec, to_partner_id: null }, now).ok, true);
assert.equal(v.validateManualTransaction({ ...transfer, type: "LOAN_REPAYMENT" }, now).ok, false);
assert.equal(v.isManualTransactionType("RECORD_AMOUNT"), true);
assert.equal(v.isManualTransactionType("CHIT_CONTRIBUTION"), false);

// ---- Dues tracker ----
const d = load("lib/duesTracker.ts", { "./monthlyAggregations": load("lib/monthlyAggregations.ts") });
const asOf = new Date(2026, 9, 30); // 30 Oct 2026
const all = { start: new Date(0), end: new Date(2026, 10, 30) };

const loan = {
  disbursementDate: new Date(2026, 5, 15), // 15 Jun → due 15 Jul, Aug, Sep, Oct, Nov...
  duration: 10, repaymentType: "Monthly", installmentAmount: 1000,
  repayments: [
    { period: 1, amount: 1000, paidDate: new Date(2026, 6, 15) },
    { period: 2, amount: 400, paidDate: new Date(2026, 7, 16) },
    { period: 3, amount: 600, paidDate: null }, // unpaid record does not count
  ],
};
let periods = d.computeLoanDuePeriods(loan, all, asOf);
assert.equal(JSON.stringify(periods.map((p) => p.period)), JSON.stringify([2, 3, 4, 5]));
assert.equal(periods[0].outstanding, 600);
assert.equal(periods[0].paid, 400);
assert.equal(periods[0].status, "overdue");
assert.equal(periods[2].daysOverdue, 15); // 15 Oct → 30 Oct
assert.equal(periods[3].status, "upcoming");
let s = d.summarizePeriods(periods);
assert.equal(s.totalOutstanding, 3600);
assert.equal(s.overdueAmount, 2600);
assert.equal(s.upcomingAmount, 1000);
assert.equal(s.overduePeriods, 3);
assert.equal(s.maxDaysOverdue, periods[0].daysOverdue);
const aging = d.addToAging(d.emptyAging(), periods);
assert.equal(aging["1-30"], 1000);
assert.equal(aging["31-60"], 1000);
assert.equal(aging["61-90"], 600);
assert.equal(aging["90+"], 0);

// Weekly loan & range filtering
const weekly = { ...loan, repaymentType: "Weekly", disbursementDate: new Date(2026, 9, 1), repayments: [] };
periods = d.computeLoanDuePeriods(weekly, { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) }, asOf);
assert.equal(JSON.stringify(periods.map((p) => p.period)), JSON.stringify([1, 2, 3, 4]));
assert.equal(periods[3].dueDate, new Date(2026, 9, 29).toISOString());
assert.equal(d.computeLoanDuePeriods({ ...loan, installmentAmount: 0 }, all, asOf).length, 0);

// Chit: first-month amount, settled balance, partial payments
const fund = { startDate: new Date(2026, 7, 5), duration: 5, monthlyContribution: 2000, firstMonthContribution: 1500 };
periods = d.computeChitMemberDuePeriods(fund, [
  { month: 1, amount: 1000, paidDate: new Date(2026, 7, 5) },
  { month: 2, amount: 1500, paidDate: new Date(2026, 8, 5), balancePaymentStatus: "Paid" },
], all, asOf);
assert.equal(JSON.stringify(periods.map((p) => p.period)), JSON.stringify([1, 3, 4]));
assert.equal(periods[0].expected, 1500);
assert.equal(periods[0].outstanding, 500);
assert.equal(periods[1].outstanding, 2000);
assert.equal(periods[2].status, "upcoming");

assert.equal(d.dueStatus(new Date(2026, 9, 30, 18), asOf), "due-today");
assert.equal(d.agingBucket(30), "1-30");
assert.equal(d.agingBucket(91), "90+");

console.log("PASS: manual transaction validation (required notes, amount, date, partners) and dues tracker calculations.");

// ---- POST /api/transactions (manual entries) with an in-memory DB ----
(async () => {
  const rows = [];
  const partnersDb = [
    { id: 1, name: "Arun", isActive: true, createdById: 7 },
    { id: 2, name: "Bala", isActive: true, createdById: 7 },
    { id: 3, name: "Other", isActive: true, createdById: 99 },
    { id: 4, name: "Gone", isActive: false, createdById: 7 },
  ];
  const notifications = [];
  const matches = (row, where) =>
    Object.entries(where).every(([k, cond]) => {
      if (k === "OR") return cond.some((c) => matches(row, c));
      if (k === "AND") return cond.every((c) => matches(row, c));
      const isDate = (x) => x && typeof x.getTime === "function";
      if (isDate(cond)) return isDate(row[k]) && row[k].getTime() === cond.getTime();
      if (cond && typeof cond === "object") {
        if ("not" in cond) return row[k] !== cond.not;
        if ("gte" in cond) return row[k] >= cond.gte;
        if ("in" in cond) return cond.in.includes(row[k]);
        if ("lt" in cond) return row[k] < cond.lt;
      }
      return row[k] === cond;
    });
  const txModel = {
    async findFirst({ where }) {
      return [...rows].reverse().find((r) => matches(r, where)) || null;
    },
    async findMany({ where }) {
      return rows.filter((r) => matches(r, where));
    },
    async create({ data }) {
      const row = { id: rows.length + 1, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
  };
  let locks = 0;
  const prisma = {
    partner: {
      async findFirst({ where }) { return partnersDb.find((p) => matches(p, where)) || null; },
      async findMany({ where }) { return partnersDb.filter((p) => matches(p, where)); },
    },
    transaction: txModel,
    async $transaction(fn) {
      return fn({ transaction: txModel, async $executeRaw() { locks++; } });
    },
  };
  const balance = load("lib/balanceCalculator.ts", { "./prisma": { default: prisma } });
  const route = load("app/api/transactions/route.ts", {
    "next/server": { NextResponse: { json: (body, o) => ({ body, status: o?.status ?? 200 }) } },
    "../../../lib/prisma": { default: prisma, __esModule: true },
    "../../../lib/auth": { getCurrentUserId: async () => 7, getActorUserId: async () => 7 },
    "../../../config/config": require("../config/config.js"),
    "../../../lib/emailConfig": {},
    xlsx: {},
    "../../../lib/balanceCalculator": balance,
    "../../../lib/transactionWhereBuilder": {},
    "../../../lib/transactionExportNameGenerator": {},
    "../../../lib/notifications": { notifyOtherAdmins: async (n) => notifications.push(n), getActorName: async () => "Admin" },
    "../../../lib/transactionValidation": v,
  }, { URL, Date });
  const today = new Date().toISOString().slice(0, 10);
  const post = (body) =>
    route.POST({
      url: "http://x/api/transactions",
      headers: { get: (h) => (h === "x-active-partner" ? "Arun" : null) },
      json: async () => body,
    });

  const base = { type: "PARTNER_TO_PARTNER", amount: "5000", date: today, from_partner_id: 1, to_partner_id: 2 };
  let res = await post({ ...base, note: "" });
  assert.equal(res.status, 400);
  assert.ok(res.body.fieldErrors.note);
  res = await post({ ...base, to_partner_id: 3, note: "Cash handover" });
  assert.equal(res.status, 400, "partner from another account is rejected");
  res = await post({ ...base, to_partner_id: 4, note: "Cash handover" });
  assert.equal(res.status, 400, "inactive partner is rejected");
  assert.equal(rows.length, 0);

  res = await post({ ...base, note: "  Cash handover  " });
  assert.equal(res.status, 201);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].note, "Transfer to Bala - Cash handover");
  assert.equal(rows[1].note, "Transfer from Arun - Cash handover");
  assert.equal(rows[0].partnerBalance, -5000);
  assert.equal(rows[1].partnerBalance, 5000);
  assert.equal(rows[1].totalBalance, 0);
  assert.equal(locks, 1);
  assert.match(notifications[0].message, /Cash handover/);
  assert.equal(notifications[0].link, "/transactions?txn=1,2");
  assert.equal(notifications[0].entityType, "transaction");
  assert.equal(notifications[0].entityId, 1);
  assert.equal(notifications[0].details.reason, "Cash handover");
  assert.equal(notifications[0].details.direction, "transfer");
  assert.equal(notifications[0].details.fromPartner, "Arun");
  assert.equal(notifications[0].details.toPartner, "Bala");
  assert.equal(JSON.stringify(notifications[0].details.transactionIds), "[1,2]");

  res = await post({ ...base, note: "Cash handover" });
  assert.equal(res.status, 409, "identical resubmission is rejected");
  assert.equal(rows.length, 2);

  res = await post({ type: "RECORD_AMOUNT", amount: 1000, date: today, note: "Capital investment", from_partner_id: null, to_partner_id: 1 });
  assert.equal(res.status, 201);
  assert.equal(rows[2].partnerBalance, -4000);
  assert.equal(rows[2].totalBalance, 1000);
  res = await post({ type: "RECORD_AMOUNT", amount: 1000, date: today, note: "", from_partner_id: null, to_partner_id: 1 });
  assert.equal(res.status, 400, "record amount needs a reason");
  assert.equal(notifications[1].details.direction, "credit");
  assert.equal(notifications[1].link, "/transactions?txn=3");

  // GET /api/notifications/:id/details
  const notificationsDb = [
    { id: 10, userId: 5, entityType: "transaction", entityId: 1, details: { transactionIds: [1, 2] } },
    { id: 11, userId: 5, entityType: "transaction", entityId: 999, details: { transactionIds: [999] } },
    { id: 12, userId: 5, entityType: null, entityId: null, details: null, link: "/loans/4" },
    { id: 13, userId: 6, entityType: "transaction", entityId: 1, details: { transactionIds: [1, 2] } },
  ];
  const detailsRoute = load("app/api/notifications/[id]/details/route.ts", {
    "next/server": { NextResponse: { json: (body, o) => ({ body, status: o?.status ?? 200 }) } },
    "../../../../../lib/prisma": {
      default: {
        notification: { async findFirst({ where }) { return notificationsDb.find((n) => matches(n, where)) || null; } },
        transaction: txModel,
      },
      __esModule: true,
    },
    "../../../../../lib/auth": { getCurrentUserId: async () => 7, getActorUserId: async () => 5 },
  });
  const details = (id) => detailsRoute.GET({}, { params: Promise.resolve({ id: String(id) }) });
  res = await details(10);
  assert.equal(res.status, 200);
  assert.equal(res.body.transactions.length, 2);
  assert.equal(res.body.entityMissing, false);
  res = await details(11);
  assert.equal(res.body.entityMissing, true, "deleted transaction is reported, not an error");
  res = await details(12);
  assert.equal(res.status, 200);
  assert.equal(res.body.transactions.length, 0);
  assert.equal(res.body.entityMissing, false);
  assert.equal((await details(13)).status, 404, "cannot open another user's notification");
  assert.equal((await details("abc")).status, 400);

  console.log("PASS: POST /api/transactions enforces reasons, partner ownership, duplicate guard and balances; notification details endpoint.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
