#!/usr/bin/env node
/**
 * Idempotent 004 publish migration: ADD COLUMN only when missing, then run 004_publish.sql.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const remote = process.argv.includes('--remote');
const locationFlag = remote ? '--remote' : '--local';
const COLUMN = 'publisher_token_hash';

/** Run wrangler d1 execute and return stdout. */
function wranglerExecute(extraArgs) {
  return execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'opd-db', locationFlag, ...extraArgs],
    { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

/** True if prompts already has publisher_token_hash (existing DBs / re-runs). */
function hasPublisherColumn() {
  const raw = wranglerExecute(['--command', 'PRAGMA table_info(prompts);', '--json']);
  const batches = JSON.parse(raw);
  for (const batch of batches) {
    const rows = batch?.results ?? [];
    for (const row of rows) {
      if (row?.name === COLUMN) return true;
    }
  }
  return false;
}

if (!hasPublisherColumn()) {
  console.log(`[004] Adding prompts.${COLUMN} (${remote ? 'remote' : 'local'})…`);
  wranglerExecute([
    '--command',
    `ALTER TABLE prompts ADD COLUMN ${COLUMN} TEXT;`,
    '-y',
  ]);
} else {
  console.log(`[004] prompts.${COLUMN} already present — skipping ALTER`);
}

console.log('[004] Applying migrations/004_publish.sql…');
wranglerExecute(['--file', './migrations/004_publish.sql', '-y']);
console.log('[004] Done');
