#!/usr/bin/env node
/**
 * UI conventions ratchet (no dependencies).
 *
 * Counts, in every .tsx file under app/ and components/:
 *   reload        window.location.reload
 *   alert         alert( / window.alert(
 *   confirm       confirm( / window.confirm(
 *   hardNav       window.location.href = …   (use router.push or <Link>)
 *   palette       raw brand-palette classes: bg-blue-600, text-blue-600, bg-red-600,
 *                 bg-green-600, and any purple/indigo/orange/teal/pink utility
 *
 * Fails (exit 1) when a rule's total is above the checked-in baseline, or when
 * anything matches inside components/ui or components/kit (those must stay clean).
 * Comments are ignored.
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
const SCAN_DIRS = ['app', 'components'];
const CLEAN_DIRS = ['components/ui', 'components/kit'];
const BASELINE_FILE = path.join(__dirname, 'ui-conventions-baseline.json');

const PALETTE_FAMILIES = 'purple|indigo|orange|teal|pink';
const UTILITY_PREFIX = '(?:bg|text|border|ring|ring-offset|from|via|to|fill|stroke|divide|outline|shadow|accent|decoration|placeholder|caret)';

const RULES = {
  reload: /window\.location\.reload\b/g,
  alert: /(?:\bwindow\.alert|(?<![\w$.])alert)\s*\(/g,
  confirm: /(?:\bwindow\.confirm|(?<![\w$.])confirm)\s*\(/g,
  hardNav: /window\.location\.href\s*=(?!=)/g,
  palette: new RegExp(
    `(?<![\\w-])(?:bg-blue-600|text-blue-600|bg-red-600|bg-green-600|${UTILITY_PREFIX}-(?:${PALETTE_FAMILIES})-\\d{2,3})(?![\\w-])`,
    'g'
  ),
};

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.tsx')) out.push(full);
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
      const text = stripComments(fs.readFileSync(file, 'utf8'));
      for (const [rule, re] of Object.entries(RULES)) {
        const n = (text.match(re) || []).length;
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

  console.log('rule       baseline  now');
  for (const rule of Object.keys(RULES)) {
    const was = baseline.totals[rule] ?? 0;
    const now = totals[rule];
    const mark = now > was ? '✗ up' : now < was ? '↓ down (run --update to lock in)' : '';
    if (now > was) failed = true;
    console.log(`${rule.padEnd(10)} ${String(was).padStart(8)}  ${String(now).padStart(3)}  ${mark}`);
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
