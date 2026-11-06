// node tests/test-loan-recovery-ui.js — rendered UI and form interactions, without a server/database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { randomUUID } = require('node:crypto');
const source = fs.readFileSync(path.resolve(__dirname, '../app/components/loans/LoanRecoveryPanel.tsx'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const currency = value => value == null ? 'N/A' : `INR ${Number(value).toFixed(2)}`;
const date = value => value ? new Date(value).toISOString().slice(0, 10) : 'N/A';
function fixture(status = 'Active') {
  return { id: 10, status, remainingAmount: 30000, updatedAt: '2026-11-05T10:00:00Z',
    ...(status === 'Non-Recoverable' ? { nonRecoverableAt: '2026-11-05T09:00:00Z', nonRecoverableReason: 'Borrower not responding',
      recoveryPrincipalAtMark: 30000, recoveryDuesAtMark: 5000, recoveryInterestOutstanding: 1000, recoveryAmount: 0, recoveryOutcome: 'Open' } : {}) };
}
const recoveryData = { preview: { duesAtMark: 5000, totalOutstanding: 7500, overdueAmount: 5000, overduePeriods: 2 }, events: [], receipts: [] };

function harness(loan, initialData = recoveryData, mode = 'panel') {
  let hook = 0, tree, updates = 0, invalidations = 0, failNext = false, reads = 0;
  const states = [], effects = [], dependencies = [], calls = [];
  const partner = { id: 1, name: 'Me', isActive: true };
  const hooks = {
    useState(initial) { const i = hook++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef(initial) { const i = hook++; if (!(i in states)) states[i] = { current: initial }; return states[i]; },
    useEffect(effect, deps) { const i = hook++; if (!dependencies[i] || deps.some((d, n) => !Object.is(d, dependencies[i][n]))) { dependencies[i] = deps; effects.push(effect); } },
  };
  const imports = {
    react: hooks,
    'react/jsx-runtime': require('react/jsx-runtime'),
    '../../../lib/formatUtils': { formatCurrency: currency, formatDate: date },
    '../../../lib/dashboardCache': { invalidateDashboardCache() { invalidations++; } },
    '../../../lib/loanRecovery': { NON_RECOVERABLE: 'Non-Recoverable' },
    '../../contexts/PartnerContext': { usePartner: () => ({ selectedPartner: partner, partners: [partner], partnerLocked: false }) },
    '../ui/ActionDropdown': { default: () => React.createElement('button', { type: 'button', 'aria-label': 'Actions' }, 'Actions') },
  };
  const context = { exports: {}, require(name) { assert.ok(name in imports, `unexpected import ${name}`); return imports[name]; },
    crypto: { randomUUID }, console, Date, Error,
    fetch: async (url, options) => {
      if (!options?.method) { reads++; return { ok: true, json: async () => initialData }; }
      const body = JSON.parse(options.body); calls.push(body);
      if (failNext) { failNext = false; throw new Error('Connection lost'); }
      return { ok: true, json: async () => ({ loan: {}, event: {} }) };
    },
  };
  vm.runInNewContext(code, context);
  const Component = context.exports.default;
  const render = () => { hook = 0; tree = Component({ loan, mode, onChange: async () => { updates++; } }); return renderToStaticMarkup(tree); };
  const nodes = () => {
    const result = [];
    const visit = item => { if (Array.isArray(item)) return item.forEach(visit); if (!item || typeof item !== 'object') return; result.push(item); visit(item.props?.children); };
    visit(tree); return result;
  };
  const text = item => renderToStaticMarkup(item).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const click = label => {
    const element = nodes().find(n => n.type === 'button' && text(n) === label);
    const menuAction = nodes().flatMap(n => n.props?.actions || []).find(a => a.label === label);
    assert.ok(element || menuAction, `action ${label}`);
    if (element) element.props.onClick(); else menuAction.onClick();
    render();
  };
  const fill = (label, value) => {
    const element = nodes().find(n => n.type === 'label' && text(n).startsWith(label));
    assert.ok(element, `label ${label}`);
    const inputs = React.Children.toArray(element.props.children).filter(n => n?.props?.onChange);
    assert.equal(inputs.length, 1); inputs[0].props.onChange({ target: { value, checked: value } }); render();
  };
  const submit = () => nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  return { render, click, fill, submit, calls, loan,
    async load() { render(); while (effects.length) effects.shift()(); await new Promise(setImmediate); return render(); },
    escape() { nodes().find(n => n.type === 'dialog').props.onCancel({ preventDefault() {} }); render(); },
    fail() { failNext = true; }, get updates() { return updates; }, get invalidations() { return invalidations; }, get reads() { return reads; } };
}

(async () => {
  const ordinary = harness(fixture());
  assert.equal(await ordinary.load(), '', 'active loans have no persistent recovery card');
  assert.equal(ordinary.reads, 0);
  const active = harness(fixture(), recoveryData, 'menu');
  assert.doesNotMatch(await active.load(), /Recovery Management|<dialog/);
  assert.equal(active.reads, 0, 'recovery balances load only when needed');
  active.click('Mark as Non-Recoverable');
  assert.equal(active.calls.length, 0, 'opening confirmation does not change the loan');
  assert.match(await active.load(), /role="dialog"/);
  assert.match(active.render(), /Mark this loan as Non-Recoverable\?/);
  assert.match(active.render(), /Unpaid interest to track/);
  assert.match(active.render(), /Installment dues include principal/);
  active.fill('Unpaid interest to track', '1000'); active.fill('Reason', 'Borrower not responding');
  await active.submit();
  assert.equal(active.calls[0].action, 'mark'); assert.equal(active.calls[0].unpaidInterest, '1000');
  assert.equal(active.updates, 1); assert.equal(active.invalidations, 1);

  const cancelled = harness(fixture(), recoveryData, 'menu');
  await cancelled.load(); cancelled.click('Mark as Non-Recoverable'); await cancelled.load();
  cancelled.click('Cancel'); assert.doesNotMatch(cancelled.render(), /<dialog/); assert.equal(cancelled.calls.length, 0);
  cancelled.click('Mark as Non-Recoverable'); await cancelled.load(); cancelled.escape();
  assert.doesNotMatch(cancelled.render(), /<dialog/); assert.equal(cancelled.calls.length, 0, 'Escape cancels without a write');

  const marked = harness(fixture('Non-Recoverable'));
  let html = await marked.load();
  assert.match(html, /Excluded from routine collections/); assert.match(html, /INR 30000.00/);
  marked.click('Record Recovery'); marked.fill('Principal received', '10000'); marked.fill('Interest received', '0'); marked.fill('Recovery notes / reference', 'Cash receipt 123');
  marked.fail(); await marked.submit();
  assert.match(marked.render(), /Connection lost/);
  await Promise.all([marked.submit(), marked.submit()]);
  assert.equal(marked.calls.length, 2, 'double click does not submit twice');
  assert.equal(marked.calls[0].requestId, marked.calls[1].requestId, 'network retry retains idempotency ID');
  assert.equal(marked.updates, 1);

  const restore = harness(fixture('Non-Recoverable'));
  await restore.load(); restore.click('Restore to Active');
  html = restore.render(); assert.match(html, /INR 5000.00/); assert.match(html, /including unpaid periods/);
  restore.fill('I reviewed the returning dues', true); restore.fill('Reason', 'Borrower resumed repayments');
  await restore.submit(); assert.equal(restore.calls[0].confirmRestore, true);

  const settle = harness(fixture('Non-Recoverable'));
  await settle.load(); settle.click('Settle Case'); settle.fill('Principal received', '10000'); settle.fill('Reason', 'Agreed final settlement');
  assert.match(settle.render(), /remaining principal of INR 20000.00/);
  settle.fill('Close this recovery case', true); await settle.submit(); assert.equal(settle.calls[0].confirmSettlement, true);

  const closed = harness({ ...fixture('Non-Recoverable'), remainingAmount: 0, recoveryInterestOutstanding: 0, recoveryOutcome: 'Settled' });
  html = await closed.load(); assert.doesNotMatch(html, />Record Recovery<|>Restore to Active<|>Settle Case</);
  const corrected = harness(fixture('Non-Recoverable'), { ...recoveryData, receipts: [{ id: 99, amount: 1000, principalComponent: 900, interestComponent: 100, paidDate: '2026-11-05T10:00:00Z', createdAt: '2026-11-05T10:00:00Z', notes: 'Receipt 99' }] });
  await corrected.load(); corrected.click('Reverse receipt #99'); corrected.fill('Reason', 'Wrong amount entered'); await corrected.submit(); assert.equal(corrected.calls[0].repaymentId, 99);
  console.log('PASS: recovery forms, separate balances, restoration preview, settlement waiver, receipt reversal, retry identity and double-submit guard.');
})().catch(error => { console.error(error); process.exitCode = 1; });
