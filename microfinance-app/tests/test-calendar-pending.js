// Run with: node tests/test-calendar-pending.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
function load(file, mocks, suffix = "", globals = {}) {
  const result = ts.transpileModule(
    fs.readFileSync(path.join(root, file), "utf8") + suffix,
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      reportDiagnostics: true,
    }
  );
  assert.equal(result.diagnostics.length, 0);
  const context = {
    exports: {},
    console,
    ...globals,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(result.outputText, context);
  return context.exports;
}
async function checkApi(kind, fixtures, check) {
  let user = 42;
  const queries = [];
  const route = load(`app/api/transactions/pending-${kind}/route.ts`, {
    "next/server": {
      NextResponse: {
        json: (body, options) => ({ body, status: options?.status ?? 200 }),
      },
    },
    "../../../../lib/prisma": {
      [kind === "loans" ? "loan" : "chitFund"]: {
        async findMany(query) {
          queries.push(query);
          return fixtures;
        },
      },
    },
    "../../../../lib/auth": { getCurrentUserId: async () => user },
    "../../../../lib/monthlyAggregations": load(
      "lib/monthlyAggregations.ts",
      {}
    ),
  });
  const request = (query) => ({
    nextUrl: { searchParams: new URLSearchParams(query) },
  });
  const response = await route.GET(
    request("startDate=2026-10-01&endDate=2026-10-31")
  );
  assert.equal(response.status, 200);
  check(response.body);
  assert.equal(queries[0].where.createdById, 42);
  assert.equal(queries[0].where.status, "Active");
  for (const query of [
    "startDate=invalid&endDate=2026-10-31",
    "startDate=2026-11-01&endDate=2026-10-31",
  ])
    assert.equal((await route.GET(request(query))).status, 400);
  user = null;
  assert.equal((await route.GET(request(""))).status, 401);
}
async function checkUi(kind, data, expected) {
  let hook = 0,
    fail = false;
  const states = [],
    effects = [],
    calls = [];
  const page = load(
    "app/calendar/page.tsx",
    {
      react: {
        ...React,
        useState(initial) {
          const i = hook++;
          if (!(i in states)) states[i] = initial;
          return [
            states[i],
            (next) => {
              states[i] = typeof next === "function" ? next(states[i]) : next;
            },
          ];
        },
        useEffect(effect) {
          effects.push(effect);
        },
      },
      "next/link": ({ href, children, ...props }) =>
        React.createElement("a", { href, ...props }, children),
      "../../lib/api": {},
      "../components/common/BackTitle": () => null,
      "date-fns": require("date-fns"),
    },
    "\nexport { PendingMembersModal, MonthlyStatsCards };",
    {
      AbortController,
      fetch: async (url, options) => {
        calls.push({ url, options });
        return { ok: !fail, json: async () => data };
      },
    }
  );
  const render = () => {
    hook = 0;
    return page.PendingMembersModal({
      kind,
      month: new Date(2026, 9, 8),
      onClose() {},
    });
  };
  assert.match(renderToStaticMarkup(render()), /Loading pending members/);
  const cleanup = effects[0]();
  await new Promise(setImmediate);
  let html = renderToStaticMarkup(render());
  for (const text of expected) assert.ok(html.includes(text), text);
  assert.match(calls[0].url, /startDate=2026-10-01&endDate=2026-10-31/);
  assert.equal(calls[0].options.cache, "no-store");
  fail = true;
  effects[0]();
  await new Promise(setImmediate);
  html = renderToStaticMarkup(render());
  assert.match(html, /Unable to load pending members/);
  assert.match(html, /Retry/);
  assert.ok(!html.includes("No pending payments"));
  cleanup();
  assert.equal(calls[0].options.signal.aborted, true);
  const buttons = [];
  let opened;
  const stats = {
    actualLoanRepayment: 0,
    expectedLoanRepayment: 1000,
    actualChitContribution: 0,
    expectedChitContribution: 1000,
    totalDocumentCharges: 0,
    totalLoanDisbursement: 0,
    totalAuctionPayouts: 0,
  };
  const cards = page.MonthlyStatsCards({
    stats,
    monthLabel: "October 2026",
    onOpenModal() {
      throw new Error("Wrong modal");
    },
    onOpenPending(value) {
      opened = value;
    },
    onOpenSummary() {},
  });
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === "button") buttons.push(node);
    visit(node.props?.children);
  };
  visit(cards);
  const button = buttons.find(
    (b) =>
      b.props["aria-label"] ===
      (kind === "loan_repayment"
        ? "View pending loan members"
        : "View pending chit members")
  );
  assert.ok(button);
  let stopped = false;
  button.props.onClick({
    stopPropagation() {
      stopped = true;
    },
  });
  assert.equal(stopped, true);
  assert.equal(opened, kind);
}
(async () => {
  const loan = {
    id: 1,
    borrower: { name: "Unpaid Borrower" },
    loanType: "Flat",
    amount: 10000,
    installmentAmount: 1000,
    duration: 2,
    repaymentType: "Monthly",
    disbursementDate: "2026-09-30T12:00:00Z",
    repayments: [],
  };
  await checkApi(
    "loans",
    [
      loan,
      {
        ...loan,
        id: 2,
        repayments: [{ period: 1, amount: 400, paidDate: "2026-10-30" }],
      },
      {
        ...loan,
        id: 3,
        repayments: [{ period: 1, amount: 1000, paidDate: "2026-10-30" }],
      },
      {
        ...loan,
        id: 4,
        repaymentType: "Weekly",
        disbursementDate: "2026-09-30",
        duration: 5,
        repayments: [
          { period: 1, amount: 400, paidDate: "2026-10-07" },
          { period: 1, amount: 600, paidDate: "2026-10-08" },
        ],
      },
      {
        ...loan,
        id: 5,
        loanType: "Reducing Balance",
        installmentAmount: 0,
        remainingAmount: 12000,
        interestPercentage: 12,
      },
      { ...loan, id: 6, disbursementDate: "2026-09-01", duration: 1 },
    ],
    (body) => {
      assert.equal(body.pendingLoans.length, 5);
      assert.equal(
        body.pendingLoans.find((l) => l.id === 2).pendingAmount,
        600
      );
      assert.equal(
        body.pendingLoans.find((l) => l.id === 4).pendingAmount,
        3000
      );
      assert.equal(body.pendingLoans.find((l) => l.id === 4).pendingPeriods, 3);
      assert.equal(
        body.pendingLoans.find((l) => l.id === 5).pendingAmount,
        120
      );
    }
  );
  const member = (id, amount) => ({
    id,
    globalMember: { name: `Member ${id}` },
    contributions:
      amount == null ? [] : [{ month: 1, amount, paidDate: "2026-10-08" }],
  });
  const fund = {
    id: 1,
    name: "October Fund",
    totalAmount: 10000,
    monthlyContribution: 1000,
    firstMonthContribution: 800,
    startDate: "2026-10-31T12:00:00Z",
    duration: 3,
    members: [
      member(1),
      member(2, 300),
      member(3, 800),
      member(4, 900),
      {
        ...member(6, 300),
        contributions: [
          {
            month: 1,
            amount: 300,
            paidDate: "2026-10-08",
            balancePaymentStatus: "Paid",
            balance: 0,
          },
        ],
      },
    ],
  };
  await checkApi(
    "chits",
    [
      fund,
      { ...fund, id: 2, startDate: "2026-08-31", members: [member(5)] },
      { ...fund, id: 3, firstMonthContribution: 0 },
    ],
    (body) => {
      assert.equal(body.pendingChitFunds.length, 2);
      const first = body.pendingChitFunds[0];
      assert.equal(first.pendingMembers.length, 2);
      assert.equal(first.pendingMembers[0].pendingAmount, 800);
      assert.equal(first.pendingMembers[1].pendingAmount, 500);
      assert.equal(first.totalPendingAmount, 1300);
      assert.equal(
        body.pendingChitFunds[1].pendingMembers[0].pendingMonths.join(","),
        "2,3"
      );
      assert.equal(
        body.pendingChitFunds[1].pendingMembers[0].pendingAmount,
        2000
      );
    }
  );
  await checkUi(
    "loan_repayment",
    {
      pendingLoans: [
        {
          ...loan,
          borrowerName: "Unpaid Borrower",
          pendingAmount: 600,
          pendingPeriods: 1,
        },
      ],
    },
    ["Unpaid Borrower", "/loans/1/repayments", "₹600", "October 2026"]
  );
  await checkUi(
    "chit_contribution",
    {
      pendingChitFunds: [
        {
          id: 1,
          name: "October Fund",
          pendingMembers: [
            {
              memberId: 2,
              memberName: "Member Two",
              pendingAmount: 500,
              pendingPeriods: 1,
              pendingMonths: [2],
            },
          ],
        },
      ],
    },
    [
      "Member Two",
      "October Fund",
      "/chit-funds/1/contributions?month=2",
      "₹500",
    ]
  );
  await checkUi("loan_repayment", { pendingLoans: [] }, [
    "No pending payments for this month.",
  ]);
  console.log(
    "PASS: pending APIs and calendar controls; unpaid/partial/full payments, weekly loans, first-month amounts, month boundaries, auth, errors, empty lists and links."
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
