#!/usr/bin/env node
/**
 * UI conventions ratchet (no dependencies).
 *
 * Counts, in every .ts/.tsx/.js/.jsx file under app/, components/ and lib/:
 *   reload        window.location.reload
 *   alert         alert( / window.alert(
 *   confirm       confirm( / window.confirm(
 *   hardNav       window.location.href = …   (use router.push or <Link>). Export downloads to
 *                 an /api/ URL are not counted; login's post-login full load is the one counted
 *   palette       any raw Tailwind palette colour (bg-blue-600, dark:hover:text-gray-300, …):
 *                 use the tokens (bg-primary, text-muted-foreground, text-success-text, …).
 *                 Allowed in PALETTE_ALLOW only
 *   heroicons     imports from @heroicons/react (the app uses lucide-react)
 *   swipeable     imports from react-swipeable (SwipeableTabs has its own gesture code)
 *   tsNocheck     // @ts-nocheck (counted in comments too)
 *   bigPage       a client request for more than 100 rows (pageSize=1000, pageSize: 500, limit=200):
 *                 list endpoints cap pageSize at 100; use the endpoint's explicit all-rows request
 *                 (e.g. all=1) or a server search
 *   legacyClass   the deleted legacy CSS classes (.btn-*, .themed-*, .badge-*, .page-container,
 *                 .table-*, .modal-overlay, …): use components/ui and components/kit
 *
 * Fails (exit 1) when a rule's total is above the checked-in baseline, or when
 * anything matches inside components/ui or components/kit (those must stay clean).
 * Comments are ignored (except by tsNocheck).
 *
 *   node scripts/check-ui-conventions.js            check
 *   node scripts/check-ui-conventions.js --update   lower the baseline to today's counts
 *                                                   (refuses to raise it)
 *   node scripts/check-ui-conventions.js --list     also print every file with matches
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const CLEAN_DIRS = ['components/ui', 'components/kit'];
const BASELINE_FILE = path.join(__dirname, 'ui-conventions-baseline.json');
const EXTENSIONS = /\.(?:tsx?|jsx?)$/;

/**
 * Where raw palette colours are allowed:
 *   app/styleguide/  the dev-only reference page may show raw colours next to the tokens.
 * Charts need no entry: they take their series colours from chartColor() (--chart-1..6).
 */
const PALETTE_ALLOW = ['app/styleguide/'];

const PALETTE_FAMILIES =
  'gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const UTILITY_PREFIX = '(?:bg|text|border|ring|from|to|via|fill|stroke)';

const LEGACY_CLASSES = [
  'themed-[a-z-]+',
  'dark-(?:card|input|table)',
  'btn-(?:primary|secondary|neutral|danger)',
  'badge-(?:base|green|paid|blue|amber|overdue)',
  'status-badge-(?:active|upcoming|completed)',
  'page-container',
  'table-(?:shell|card|toolbar|footer|th|td|foot-row|sticky-cell|sticky-head|row-overdue|row-due-soon)',
  'modal-overlay',
  'filter-chip(?:-active-(?:blue|green))?',
  'pagination-(?:nav-btn|page|page-active|info|btn|btn-active|bordered)',
  'alert-(?:error|success)',
  'form-panel',
  'dropdown-(?:trigger|item|item-active)',
  'nav-active',
  'metric-row(?:-(?:blue|green|red|highlight))?',
  'list-item-row',
  'progress-track',
  'card-title',
  'section-heading',
  'page-title',
  'detail-(?:label|value)',
  'calendar-(?:day|day-header|day-empty|day-today|event|event-(?:loan|paid|chit|due|overdue))',
].join('|');

const RULES = {
  reload: /window\.location\.reload\b/g,
  alert: /(?:\bwindow\.alert|(?<![\w$.])alert)\s*\(/g,
  confirm: /(?:\bwindow\.confirm|(?<![\w$.])confirm)\s*\(/g,
  hardNav: /window\.location\.href\s*=(?!=)(?!\s*[`'"]\/api\/)/g,
  // Bare or behind any variant chain (dark:, hover:, md:dark:hover:, …), with an optional /opacity.
  palette: new RegExp(`(?<![\\w-])${UTILITY_PREFIX}-(?:${PALETTE_FAMILIES})-\\d{2,3}(?![\\w-])`, 'g'),
  heroicons: /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]@heroicons\/react(?:\/[^'"]*)?['"]/g,
  swipeable: /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]react-swipeable['"]/g,
  tsNocheck: /\/\/\s*@ts-nocheck\b/g,
  // pageSize=…, pageSize: …, limit=… (query string) or limit: … (params object); not `limit = 200` defaults.
  bigPage: /\b(?:pageSize['"]?\s*[:=]\s*|limit(?:=|['"]?\s*:\s*))['"`]?(?:[1-9]\d{3,}|[2-9]\d{2}|1(?:0[1-9]|[1-9]\d))(?!\d)/g,
  // Not after "/" or "-" so module paths such as '@/components/kit/page-container' do not count.
  legacyClass: new RegExp(`(?<![\\w/.-])(?:${LEGACY_CLASSES})(?![\\w-])`, 'g'),
};

/** Rules that read the raw source (comments included). */
const RAW_RULES = new Set(['tsNocheck']);
/** Rules that skip server code (app/api/**): they are about what the browser does or asks for. */
const CLIENT_ONLY = new Set(['hardNav', 'bigPage']);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && EXTENSIONS.test(entry.name)) out.push(full);
  }
  return out;
}

/** Remove block and line comments, keeping strings (so "http://" inside quotes survives). */
function stripComments(source) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const chunk = source.slice(i, end === -1 ? source.length : end + 2);
      out += chunk.replace(/[^\n]/g, ' ');
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (c === '/' && next === '/' && source[i - 1] !== ':') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function count() {
  const totals = Object.fromEntries(Object.keys(RULES).map((r) => [r, 0]));
  const files = {};
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir), [])) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      const raw = fs.readFileSync(file, 'utf8');
      const text = stripComments(raw);
      for (const [rule, re] of Object.entries(RULES)) {
        if (rule === 'palette' && PALETTE_ALLOW.some((p) => rel.startsWith(p))) continue;
        if (CLIENT_ONLY.has(rule) && rel.startsWith('app/api/')) continue;
        const n = ((RAW_RULES.has(rule) ? raw : text).match(re) || []).length;
        if (!n) continue;
        totals[rule] += n;
        (files[rel] ||= {})[rule] = n;
      }
    }
  }
  return { totals, files };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const { totals, files } = count();
  const sortedFiles = Object.fromEntries(Object.keys(files).sort().map((f) => [f, files[f]]));

  const dirty = Object.keys(files).filter((f) => CLEAN_DIRS.some((d) => f.startsWith(d + '/')));
  let failed = false;
  if (dirty.length) {
    failed = true;
    console.error('✗ components/ui and components/kit must not use these patterns:');
    for (const f of dirty) console.error(`  ${f}: ${JSON.stringify(files[f])}`);
  }

  const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : null;

  if (args.has('--update') || !baseline) {
    if (baseline) {
      const raised = Object.keys(totals).filter((r) => totals[r] > (baseline.totals[r] ?? 0));
      if (raised.length) {
        console.error(`✗ Refusing to raise the baseline for: ${raised.join(', ')}. Fix the new occurrences instead.`);
        process.exit(1);
      }
    }
    const data = {
      description: 'UI conventions ratchet baseline (scripts/check-ui-conventions.js). Totals may only go down.',
      totals,
      files: sortedFiles,
    };
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(data, null, 2) + '\n');
    console.log(`${baseline ? 'Updated' : 'Created'} ${path.relative(ROOT, BASELINE_FILE)}: ${JSON.stringify(totals)}`);
    process.exit(failed ? 1 : 0);
  }

  console.log('rule        baseline  now');
  for (const rule of Object.keys(RULES)) {
    const was = baseline.totals[rule] ?? 0;
    const now = totals[rule];
    const mark = now > was ? '✗ up' : now < was ? '↓ down (run --update to lock in)' : '';
    if (now > was) failed = true;
    console.log(`${rule.padEnd(11)} ${String(was).padStart(8)}  ${String(now).padStart(3)}  ${mark}`);
    if (now > was) {
      for (const [file, counts] of Object.entries(sortedFiles)) {
        const before = baseline.files?.[file]?.[rule] ?? 0;
        if ((counts[rule] ?? 0) > before) console.error(`    ${file}: ${before} → ${counts[rule]}`);
      }
    }
  }
  if (args.has('--list')) {
    for (const [file, counts] of Object.entries(sortedFiles)) console.log(`  ${file}: ${JSON.stringify(counts)}`);
  }
  if (failed) {
    console.error('UI conventions check failed. Use the kit (toast, ConfirmDialog, router.push, token classes) instead.');
    process.exit(1);
  }
  console.log('UI conventions check passed.');
}

main();
