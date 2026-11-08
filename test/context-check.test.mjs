import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateContext, ContextError } from '../scripts/context-check.mjs';

const NOW = Date.UTC(2026, 10, 7, 12);
const future = new Date(Date.now() + 3600_000).toISOString(); // CLI validates against real time
const past = new Date(NOW - 1000).toISOString();
const valid = () => ({ version: 1, taskId: 'NW020-K2',
  criteria: ['ac1'], baseline: { head: 'a'.repeat(40), manifestSha256: 'b'.repeat(64) },
  candidateSha256: 'c'.repeat(64), risk: 'normal', complexity: 'simple',
  authority: { approvedBy: 'user', scope: 'K2 offline', maxUsd: '8', expiresAt: future },
  evidence: ['Evidence/x.md'] });

const code = expected => e => e instanceof ContextError && e.code === expected;

test('a complete valid context passes', () => {
  assert.deepEqual(validateContext(valid(), NOW), { ok: true });
});

test('missing, extra and wrong-type fields are rejected', () => {
  for (const mutate of [
    c => { delete c.taskId; },
    c => { c.smuggle = true; },
    c => { c.version = 2; },
    c => { c.criteria = []; },
    c => { c.criteria = ['']; },
    c => { c.baseline.head = 'zzz'; },
    c => { c.candidateSha256 = '0'.repeat(64); },
    c => { c.risk = 'extreme'; },
    c => { c.complexity = 'weird'; },
    c => { c.authority.maxUsd = 'lots'; },
    c => { c.authority.scope = ' '; },
    c => { c.evidence = []; },
    c => { c.budget = { maxRequests: 0 }; },
    c => { c.budget = { maxRequests: 101 }; },
  ]) {
    const c = valid(); mutate(c);
    assert.throws(() => validateContext(c, NOW), code('E_CONTEXT'));
  }
});

test('expired authority blocks with E_EXPIRED, not a generic error', () => {
  const c = valid(); c.authority.expiresAt = past;
  assert.throws(() => validateContext(c, NOW), code('E_EXPIRED'));
  assert.throws(() => validateContext(c), () => true); // also expired vs real now
});

const script = fileURLToPath(new URL('../scripts/context-check.mjs', import.meta.url));
async function cli(t, files, args) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'k2-ctx-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, data] of Object.entries(files)) {
    await writeFile(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data), { mode: 0o600 });
  }
  const resolved = args.map(a => a.startsWith('@') ? path.join(dir, a.slice(1)) : a);
  return spawnSync(process.execPath, [script, ...resolved], { encoding: 'utf8' });
}

test('CLI accepts a valid context and prints the task id', async t => {
  const r = await cli(t, { 'ctx.json': valid() }, ['--context', '@ctx.json']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { ok: true, taskId: 'NW020-K2' });
});

test('CLI blocks invalid JSON and expired contexts with exit 2', async t => {
  const bad = await cli(t, { 'ctx.json': '{nope' }, ['--context', '@ctx.json']);
  assert.equal(bad.status, 2); assert.match(bad.stderr, /E_CONTEXT/);
  const expired = valid(); expired.authority.expiresAt = new Date(Date.now() - 1000).toISOString();
  const r = await cli(t, { 'ctx.json': expired }, ['--context', '@ctx.json']);
  assert.equal(r.status, 2); assert.match(r.stderr, /E_EXPIRED/);
});

test('stale candidate identity blocks conclusions via E_STALE', async t => {
  const manifestBytes = 'candidate manifest bytes v1';
  const c = valid();
  c.candidateSha256 = createHash('sha256').update(manifestBytes).digest('hex');
  const ok = await cli(t, { 'ctx.json': c, 'm.txt': manifestBytes },
    ['--context', '@ctx.json', '--manifest', '@m.txt']);
  assert.equal(ok.status, 0, ok.stderr);
  const stale = await cli(t, { 'ctx.json': c, 'm.txt': 'DRIFTED bytes' },
    ['--context', '@ctx.json', '--manifest', '@m.txt']);
  assert.equal(stale.status, 2); assert.match(stale.stderr, /E_STALE/);
});
