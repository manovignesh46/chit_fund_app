#!/usr/bin/env node
/**
 * Restore original light-theme Tailwind classes.
 * Dark styling is applied only via dark: variants.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.next', 'scripts']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function hasDarkVariant(str, utility) {
  return str.includes(`dark:${utility}`);
}

function replaceIfNoDark(content, from, to) {
  if (!content.includes(from)) return content;
  if (hasDarkVariant(content, from.split(' ').pop())) return content;
  return content.split(from).join(to);
}

const REPLACEMENTS = [
  // Table / row surfaces
  ['bg-surface-elevated', 'bg-gray-50 dark:bg-surface-elevated'],
  ['hover:bg-surface-hover', 'hover:bg-gray-50 dark:hover:bg-surface-hover'],
  ['bg-surface-hover', 'bg-gray-100 dark:bg-surface-hover'],
  ['bg-surface-card', 'bg-white dark:bg-surface-card'],
  ['bg-surface-sidebar', 'bg-white dark:bg-surface-sidebar'],
  ['bg-surface', 'bg-gray-50 dark:bg-surface'],
  // Borders
  ['border-surface-border', 'border-gray-200 dark:border-surface-border'],
  // Text (light = original grays)
  ['text-theme-primary', 'text-gray-900 dark:text-theme-primary'],
  ['text-theme-secondary', 'text-gray-700 dark:text-theme-secondary'],
  ['text-theme-muted', 'text-gray-500 dark:text-theme-muted'],
  ['text-theme-heading', 'text-gray-900 dark:text-theme-heading'],
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [from, to] of REPLACEMENTS) {
    if (content.includes(from) && !content.includes(to)) {
      // Avoid double-replacing already fixed strings
      const regex = new RegExp(`(?<!dark:)${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      const next = content.replace(regex, (match, offset) => {
        const before = content.slice(Math.max(0, offset - 6), offset);
        if (before.endsWith('dark:')) return match;
        return to;
      });
      if (next !== content) {
        content = next;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

let count = 0;
for (const file of walk(ROOT)) {
  if (processFile(file)) {
    count++;
    console.log('Updated:', path.relative(ROOT, file));
  }
}
console.log(`Done. Updated ${count} files.`);
