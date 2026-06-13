#!/usr/bin/env node
/**
 * Replace light-only button patterns with theme btn-neutral / pagination classes.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.next', 'scripts', 'app/theme']);

const REPLACEMENTS = [
  [
    'bg-gray-200 text-gray-700 dark:text-theme-secondary hover:bg-gray-300',
    'btn-neutral',
  ],
  [
    'bg-gray-200 text-gray-400 cursor-not-allowed',
    'btn-neutral opacity-50 cursor-not-allowed',
  ],
  [
    "ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:hover:bg-surface-hover focus:outline-offset-0",
    "pagination-page focus:outline-offset-0",
  ],
  [
    'text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-hover',
    'pagination-nav-btn',
  ],
  [
    'text-gray-300 cursor-not-allowed',
    'pagination-nav-btn',
  ],
  [
    'text-gray-700 dark:text-theme-secondary bg-gray-50 dark:bg-surface-elevated border border-gray-200 dark:border-surface-border rounded-lg',
    'pagination-info',
  ],
  [
    'w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    'themed-input w-full text-sm',
  ],
  [
    'px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:themed-input',
    'themed-input px-3 py-1.5 text-sm',
  ],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let count = 0;
for (const file of walk(path.join(ROOT, 'app'))) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  for (const [from, to] of REPLACEMENTS) {
    content = content.split(from).join(to);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    count++;
    console.log(path.relative(ROOT, file));
  }
}
for (const file of walk(path.join(ROOT, 'components'))) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  for (const [from, to] of REPLACEMENTS) {
    content = content.split(from).join(to);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    count++;
    console.log(path.relative(ROOT, file));
  }
}
console.log(`Updated ${count} files.`);
