#!/usr/bin/env node
// PostToolUse hook (Edit/Write/MultiEdit): after a JavaScript file changes, make sure it still parses.
// It never reformats code. Exit 2 sends the error back to Claude so it can fix the file.
const { execFileSync } = require('child_process');
let raw = '';
process.stdin.on('data', d => raw += d).on('end', () => {
  let file = '';
  try { const j = JSON.parse(raw || '{}'); file = (j.tool_input && (j.tool_input.file_path || j.tool_input.path)) || ''; } catch (e) { process.exit(0); }
  if (!/\.(m?js|cjs)$/.test(file)) process.exit(0);
  try { execFileSync(process.execPath, ['--check', file], { stdio: ['ignore', 'ignore', 'pipe'] }); process.exit(0); }
  catch (e) { process.stderr.write(`Syntax check failed for ${file}:\n${(e.stderr || '').toString().slice(0, 1500)}\nFix the syntax error before continuing.\n`); process.exit(2); }
});
