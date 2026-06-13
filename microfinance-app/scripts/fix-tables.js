#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXTENSIONS = new Set(['.tsx', '.ts']);

const REPLACEMENTS = [
  ['<tbody className="themed-card divide-y divide-surface-border">', '<tbody>'],
  ['<tbody className="divide-y divide-surface-border">', '<tbody>'],
  ['className="w-full divide-y divide-surface-border text-xs sm:text-sm"', 'className="themed-table text-xs sm:text-sm"'],
  ['className="w-full text-sm border-collapse divide-y divide-surface-border"', 'className="themed-table border-collapse"'],
  ['className="w-full divide-y divide-gray-200 text-xs sm:text-sm"', 'className="themed-table text-xs sm:text-sm"'],
  ['text-xs font-medium text-gray-500 uppercase', 'text-xs font-medium text-theme-muted uppercase'],
  ['text-left text-xs font-medium text-gray-500 uppercase', 'text-left text-xs font-medium text-theme-muted uppercase'],
  ['sticky left-0 themed-card hover:bg-surface-hover', 'sticky left-0 table-sticky-cell'],
  ['sticky left-0 bg-gray-100', 'sticky left-0 table-sticky-cell'],
  ['className="bg-gray-100 font-semibold border-t-2 border-gray-400"', 'className="table-foot-row"'],
  ['className="px-3 py-3 font-bold text-theme-primary border-r border-surface-border sticky left-0 bg-gray-100"', 'className="px-3 py-3 font-bold text-theme-primary border-r border-surface-border sticky left-0 table-sticky-cell"'],
  ['<div className="overflow-x-auto w-full" style={{maxWidth: \'85vw\'}}>', '<div className="table-shell" style={{maxWidth: \'85vw\'}}>'],
  ['<div className="overflow-x-auto w-full">', '<div className="table-shell">'],
  ['className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"', 'className="themed-input w-full text-sm"'],
  ['className="w-full px-3 py-2 border rounded-lg text-sm"', 'className="themed-input w-full text-sm"'],
  ['className="border border-surface-border rounded-md text-sm py-1 pl-2 pr-8"', 'className="themed-input text-sm py-1 pl-2 pr-8"'],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'scripts'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  for (const [from, to] of REPLACEMENTS) {
    content = content.split(from).join(to);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    changed++;
    console.log('fixed:', path.relative(ROOT, file));
  }
}
console.log(`Done. ${changed} files fixed.`);
