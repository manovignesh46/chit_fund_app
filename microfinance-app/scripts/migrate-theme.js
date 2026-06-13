#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);

const REPLACEMENTS = [
  ['container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-screen-xl w-full', 'page-container'],
  ['container mx-auto px-4 py-8 max-w-screen-xl', 'page-container'],
  ['container mx-auto px-4 py-6 max-w-screen-xl', 'page-container'],
  ['bg-white shadow-md rounded-lg overflow-hidden', 'themed-card overflow-hidden'],
  ['bg-white rounded-lg shadow-md overflow-hidden', 'themed-card overflow-hidden'],
  ['bg-white shadow-md rounded-lg', 'themed-card'],
  ['bg-white rounded-lg shadow-md', 'themed-card'],
  ['bg-white rounded-lg shadow', 'themed-card'],
  ['bg-white rounded shadow', 'themed-card'],
  ['bg-white shadow rounded-lg', 'themed-card'],
  ['bg-white p-4 rounded-lg shadow-md', 'themed-card p-4'],
  ['bg-white p-6 rounded-lg shadow-md', 'themed-card p-6'],
  ['bg-white p-4 rounded-lg shadow', 'themed-card p-4'],
  ['bg-white p-6 rounded-lg shadow', 'themed-card p-6'],
  ['bg-white rounded-lg shadow-md p-4', 'themed-card p-4'],
  ['bg-white rounded-lg shadow-md p-6', 'themed-card p-6'],
  ['bg-white rounded-lg shadow-md p-2', 'themed-card p-2'],
  ['bg-white rounded-lg shadow-md p-3', 'themed-card p-3'],
  ['bg-white shadow-md rounded-lg p-4', 'themed-card p-4'],
  ['bg-white shadow-md rounded-lg p-6', 'themed-card p-6'],
  ['bg-white shadow-md rounded-lg p-2', 'themed-card p-2'],
  ['bg-white p-4 sm:p-6 rounded-lg shadow-md', 'themed-card p-4 sm:p-6'],
  ['bg-white p-2 sm:p-6 rounded-lg shadow-md', 'themed-card p-2 sm:p-6'],
  ['bg-white p-4 sm:p-6 rounded-lg shadow', 'themed-card p-4 sm:p-6'],
  ['text-2xl sm:text-3xl font-bold text-blue-700', 'page-title'],
  ['text-lg sm:text-xl font-bold text-blue-700', 'section-heading'],
  ['text-lg font-bold text-blue-700', 'section-heading'],
  ['hover:bg-gray-50', 'hover:bg-surface-hover'],
  ['hover:bg-gray-100', 'hover:bg-surface-hover'],
  ['bg-gray-50 rounded-lg', 'bg-surface-elevated rounded-lg'],
  ['bg-gray-50', 'bg-surface-elevated'],
  ['divide-gray-200', 'divide-surface-border'],
  ['border-gray-200', 'border-surface-border'],
  ['border-gray-300', 'border-surface-border'],
  ['text-gray-900', 'text-theme-primary'],
  ['text-gray-800', 'text-theme-primary'],
  ['text-gray-700', 'text-theme-secondary'],
  ['text-gray-600', 'text-theme-secondary'],
  ['bg-red-100 border border-red-400 text-red-700', 'alert-error'],
  ['bg-red-50 border border-red-200', 'alert-error'],
  ['bg-green-100 border border-green-400 text-green-700', 'alert-success'],
  ['fixed inset-0 bg-black bg-opacity-50', 'modal-overlay'],
  ['border border-gray-300 rounded-md text-sm py-1 pl-2 pr-8', 'themed-input text-sm py-1 pl-2 pr-8'],
  ['border border-gray-300 rounded-md text-xs sm:text-sm py-1 pl-2 pr-8', 'themed-input text-xs sm:text-sm py-1 pl-2 pr-8'],
  ['px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white', 'themed-input px-3 py-1.5 text-sm'],
  ['block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900', 'themed-input block w-full px-3 py-2'],
  ['thead className="bg-gray-50"', 'thead className="bg-surface-elevated"'],
  ['tbody className="bg-white divide-y divide-gray-200"', 'tbody'],
  ['w-full divide-y divide-gray-200', 'themed-table'],
];

const SKIP_DIRS = new Set(['node_modules', '.next', '.git']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (file.includes('scripts/migrate-theme')) continue;
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  for (const [from, to] of REPLACEMENTS) {
    content = content.split(from).join(to);
  }
  // Remaining standalone bg-white in className contexts (string literals only)
  content = content.replace(/className="([^"]*)bg-white([^"]*)"/g, (match, before, after) => {
    if (before.includes('themed-card') || after.includes('themed-card')) return match;
    return `className="${before}themed-card${after}"`;
  });
  if (content !== original) {
    fs.writeFileSync(file, content);
    changed++;
    console.log('updated:', path.relative(ROOT, file));
  }
}
console.log(`Done. ${changed} files updated.`);
