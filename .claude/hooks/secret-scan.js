#!/usr/bin/env node
// Secret scanner for a PUBLIC repo.
//  - PreToolUse Edit/Write/MultiEdit: blocks writing text that looks like a secret into a file.
//  - PreToolUse Bash: when the command is a `git commit`, scans the staged diff and blocks the commit if a secret is found.
//  - Manual: `node .claude/hooks/secret-scan.js --scan-tree` scans all tracked files.
// It prints only the TYPE and location of a finding, never the value. Exit 2 = blocked (message goes to Claude).
const { execSync } = require('child_process');
const RULES = [
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{10,}/],
  ['Supabase service_role JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style API key', /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/],
  ['GitHub token', /\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['Slack token', /\bxox[abpors]-[A-Za-z0-9-]{10,}/],
  ['Stripe secret key', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/],
  ['Vercel token', /\bvercel_[A-Za-z0-9]{24,}/],
  ['Postgres URL with password', /postgres(?:ql)?:\/\/[^:\s'"]+:[^@\s'"]{6,}@/],
  ['Team account password (iLab-…)', /\biLab-[A-Za-z0-9]{10}\b/],
];
const scan = text => { const hits = []; for (const [name, re] of RULES) if (re.test(text)) hits.push(name); return hits; };
const block = (where, hits) => { process.stderr.write(`Blocked: possible secret (${hits.join(', ')}) in ${where}. This repo is public - keep secrets in Vercel/Supabase env vars and refer to them by name.\n`); process.exit(2); };

if (process.argv.includes('--scan-tree')) {
  const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(f => f && !/\.(png|jpe?g|webp|gif|mp4|webm|pdf|zip|woff2?|ico)$/i.test(f));
  let bad = 0; const fs = require('fs');
  for (const f of files) { let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch (e) { continue; } const h = scan(t); if (h.length) { bad++; console.log(`${f}: ${h.join(', ')}`); } }
  console.log(bad ? `${bad} file(s) need attention` : 'No secrets found in tracked files'); process.exit(bad ? 1 : 0);
}

let raw = '';
process.stdin.on('data', d => raw += d).on('end', () => {
  let j = {}; try { j = JSON.parse(raw || '{}'); } catch (e) { process.exit(0); }
  const ti = j.tool_input || {};
  if (j.tool_name === 'Bash') {
    if (!/\bgit\b[^|;&]*\bcommit\b/.test(ti.command || '')) process.exit(0);
    let diff = ''; try { diff = execSync('git diff --cached -U0 --no-color', { encoding: 'utf8', maxBuffer: 64 << 20 }); } catch (e) { process.exit(0); }
    const added = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
    const h = scan(added); if (h.length) block('the staged changes (git commit)', h); process.exit(0);
  }
  const text = [ti.content, ti.new_string, ...(Array.isArray(ti.edits) ? ti.edits.map(e => e.new_string) : [])].filter(Boolean).join('\n');
  const h = scan(text); if (h.length) block(ti.file_path || 'the edit', h); process.exit(0);
});
