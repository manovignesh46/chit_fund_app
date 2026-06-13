#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const map = {
  'text-theme-primary': 'text-gray-900 dark:text-theme-primary',
  'text-theme-secondary': 'text-gray-700 dark:text-theme-secondary',
  'text-theme-muted': 'text-gray-500 dark:text-theme-muted',
  'text-theme-heading': 'text-gray-900 dark:text-theme-heading',
};

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'scripts'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let count = 0;
for (const file of walk(path.join(__dirname, '..'))) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  for (const [from, to] of Object.entries(map)) {
    if (!content.includes(from)) continue;
    content = content.replace(new RegExp(from, 'g'), (match, offset) => {
      const before = content.slice(Math.max(0, offset - 50), offset);
      if (before.includes(to)) return match;
      if (before.endsWith('dark:')) return match;
      const grayPrefix = to.split(' ')[0];
      if (before.includes(grayPrefix)) return match;
      return to;
    });
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    count++;
    console.log('Updated:', path.relative(path.join(__dirname, '..'), file));
  }
}

console.log(`Done. Updated ${count} files.`);
