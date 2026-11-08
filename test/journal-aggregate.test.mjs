import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, symlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { summarizeAttempts, aggregateJournals } from '../scripts/journal-aggregate.mjs';

const sha = c => c.repeat(64);
const reserved = (id, over = {}) => ({ version: 1, approvalId: id, provider: 'deepseek',
  taskId: 'T1', candidateSha256: sha('a'), requestSha256: (id + 'b'.repeat(64)).slice(0, 64),
  model: 'deepseek-flash', effort: 'high', role: 'development', status: 'reserved',
  reservedUsd: '0.786432000', currency: 'USD', maxRequests: 1,
  pricingSnapshotSha256: sha('c'), budgetMaxUsd: '1', startedAt: '2026-11-07T00:00:00.000Z',
  actualChargeUsd: null, ...over });
const result = (id, over = {}) => ({ ...reserved(id), status: 'completed', requestAttempted: true,
  httpStatus: 200, usage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 20,
    reasoningOutputTokens: 10, totalTokens: 150 }, estimatedUsd: '0.000150000',
  providerRequestId: 'r1', providerReportedEffort: 'high', effortVerification: 'provider-reported-match',
  endedAt: '2026-11-07T00:00:01.000Z', reservationDisposition: 'held', ...over });
// Normalized loader shape (as produced by the module's directory reader)
const asLoaded = (rec, kind) => {
  const usage = kind === 'result' ? (rec.usage ?? null) : null;
  return { fileKind: kind, file: `${rec.approvalId}.${kind}.json`, approvalId: rec.approvalId,
    provider: rec.provider, taskId: rec.taskId, model: rec.model, status: rec.status,
    candidateSha256: rec.candidateSha256 ?? null, requestSha256: rec.requestSha256 ?? null,
    usage,
    estimatedUsd: kind === 'result' && rec.estimatedUsd != null
      ? (() => { const [w, f = ''] = rec.estimatedUsd.split('.'); return BigInt(w) * 1000000000n + BigInt((f + '000000000').slice(0, 9)); })()
      : null,
    reservedUsd: rec.reservedUsd != null
      ? (() => { const [w, f = ''] = rec.reservedUsd.split('.'); return BigInt(w) * 1000000000n + BigInt((f + '000000000').slice(0, 9)); })()
      : null,
    actualChargeUsd: rec.actualChargeUsd ?? null };
};

async function journalDir(t, files) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'k1-agg-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(path.join(dir, name), typeof contents === 'string' ? contents : JSON.stringify(contents), { mode: 0o600 });
  }
  return dir;
}

test('a reserved+result pair counts as ONE attempt; result supersedes reserved', () => {
  const s = summarizeAttempts([asLoaded(reserved('A'), 'reserved'), asLoaded(result('A'), 'result')]);
  assert.equal(s.attempts, 1);
  const b = s.totals;
  assert.equal(b.completed, 1); assert.equal(b.unsettled, 0);
  assert.equal(b.reservedUsd, '0.786432000'); // not doubled
  assert.equal(b.estimatedUsd, '0.000150000');
});

test('duplicate same-kind records are rejected, never silently merged', () => {
  assert.throws(() => summarizeAttempts([asLoaded(result('A'), 'result'), asLoaded(result('A'), 'result')]),
    e => e.code === 'E_JOURNAL_DUPLICATE');
});

test('reserved-only attempt is unsettled with usage unknown, never zero', () => {
  const s = summarizeAttempts([asLoaded(reserved('A'), 'reserved')]);
  assert.equal(s.attempts, 1);
  assert.equal(s.totals.unsettled, 1);
  assert.equal(s.totals.usageUnknownAttempts, 1);
  assert.equal(s.totals.inputTokens, 0); // bucket sum of zero known usages
  assert.equal(s.totals.estimatedUsd, null); // unknown cost is null, never a fabricated zero
  assert.equal(s.totals.estimatedUsdUnknownAttempts, 0); // no result record exists yet
  assert.equal(s.totals.reservedUsd, '0.786432000');
});

test('result with null usage keeps usage unknown and does not fabricate zeros', () => {
  const r = result('A'); r.status = 'unknown'; r.usage = null; r.estimatedUsd = null;
  const s = summarizeAttempts([asLoaded(r, 'result')]);
  assert.equal(s.totals.unknown, 1);
  assert.equal(s.totals.usageUnknownAttempts, 1);
  assert.equal(s.totals.estimatedUsd, null); // R02: unknown money is null, not '0.000000000'
  assert.equal(s.totals.estimatedUsdUnknownAttempts, 1);
  assert.equal(s.totals.inputTokens, 0);
});

test('R01: distinct request hashes under one approval/task are separate attempts', () => {
  const r1 = result('SAME');
  const r2 = result('SAME'); r2.requestSha256 = 'f'.repeat(64);
  const s = summarizeAttempts([asLoaded(r1, 'result'), asLoaded(r2, 'result')]);
  assert.equal(s.attempts, 2); // not merged by the approval-level fallback key
  assert.equal(s.totals.inputTokens, 200);
});

test('R04: partially null usage counts as unknown without hiding known fields', () => {
  const r = result('A'); r.usage = { inputTokens: null, outputTokens: 50, cachedInputTokens: 0, reasoningOutputTokens: 10, totalTokens: 50 };
  const s = summarizeAttempts([asLoaded(r, 'result')]);
  assert.equal(s.totals.usageUnknownAttempts, 1);
  assert.equal(s.totals.inputTokens, 0);
  assert.equal(s.totals.outputTokens, 50);
});

test('R05: a result inherits the reservation from its superseded reserved record', () => {
  const res = reserved('A', { reservedUsd: '0.500000000' });
  const fin = result('A', { reservedUsd: '0.500000000' }); fin.reservedUsd = null;
  const s = summarizeAttempts([asLoaded(res, 'reserved'), asLoaded(fin, 'result')]);
  assert.equal(s.attempts, 1);
  assert.equal(s.totals.reservedUsd, '0.500000000'); // inherited, not dropped
});

test('cached and reasoning subsets are tracked but never folded into input/output', () => {
  const s = summarizeAttempts([asLoaded(result('A'), 'result'), asLoaded(result('B'), 'result')]);
  const b = s.totals;
  assert.equal(b.inputTokens, 200); // NOT 200 + anything cached
  assert.equal(b.outputTokens, 100); // NOT 100 + reasoning
  assert.equal(b.cachedInputTokens, 40);
  assert.equal(b.reasoningOutputTokens, 20);
  assert.equal(b.inputTokens + b.cachedInputTokens, 240); // proves separation, not inclusion
});

test('providers and models never share a bucket', () => {
  const codex = asLoaded(result('C', { provider: 'codex', model: 'gpt-6.1-sol' }), 'result');
  const kimi = asLoaded(result('K', { provider: 'kimi', model: 'k2' }), 'result');
  const ds = asLoaded(result('D'), 'result');
  const s = summarizeAttempts([codex, kimi, ds]);
  const providers = s.scopes.unscoped.providers;
  assert.deepEqual(Object.keys(providers).sort(), ['codex', 'deepseek', 'kimi']);
  assert.equal(providers.codex['gpt-6.1-sol'].inputTokens, 100);
  assert.equal(providers.deepseek['deepseek-flash'].inputTokens, 100);
  assert.equal(providers.kimi['k2'].inputTokens, 100);
});

test('scope map assigns phases; unmapped attempts fall back to unscoped', () => {
  const s = summarizeAttempts(
    [asLoaded(result('A', { taskId: 'PREP' }), 'result'), asLoaded(result('B', { taskId: 'RUN' }), 'result')],
    { PREP: 'preparation', RUN: 'execution' });
  assert.equal(s.scopes.preparation.providers.deepseek['deepseek-flash'].attempts, 1);
  assert.equal(s.scopes.execution.providers.deepseek['deepseek-flash'].attempts, 1);
  assert.equal(s.unscopedAttempts, 0);
  const u = summarizeAttempts([asLoaded(result('A'), 'result')]);
  assert.equal(u.unscopedAttempts, 1);
  assert.throws(() => summarizeAttempts([asLoaded(result('A'), 'result')], { A: 'lunch' }),
    e => e.code === 'E_JOURNAL_SCOPE_INVALID');
});

test('nanodollar money math has no float drift', () => {
  const records = [];
  for (let i = 0; i < 10; i++) records.push(asLoaded(result('M' + i, { estimatedUsd: '0.000000001', usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0 } }), 'result'));
  const s = summarizeAttempts(records);
  assert.equal(s.totals.estimatedUsd, '0.000000010');
});

test('unreconciled charges are surfaced, not assumed zero', () => {
  const s = summarizeAttempts([asLoaded(result('A'), 'result')]);
  assert.equal(s.unreconciledAttempts, 1); // actualChargeUsd null
  assert.equal(s.estimatedUsdAreEstimates, true);
});

test('CLI: malformed JSON record exits nonzero with a coded error', async t => {
  const dir = await journalDir(t, { 'bad.result.json': '{not json' });
  const script = fileURLToPath(new URL('../scripts/journal-aggregate.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script, '--journal-dir', dir], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /E_JOURNAL_MALFORMED/);
});

test('CLI: empty directory yields zero attempts and exit 0', async t => {
  const dir = await journalDir(t, {});
  const script = fileURLToPath(new URL('../scripts/journal-aggregate.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script, '--journal-dir', dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).attempts, 0);
});

test('CLI: symlinked journal file is rejected', async t => {
  if (process.platform === 'win32') return t.skip('symlink fixture requires POSIX');
  const dir = await journalDir(t, { 'real.result.json': result('A') });
  await symlink(path.join(dir, 'real.result.json'), path.join(dir, 'link.result.json'));
  const script = fileURLToPath(new URL('../scripts/journal-aggregate.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script, '--journal-dir', dir], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /E_JOURNAL_SYMLINK/);
});

test('R03: unknown CLI argument exits 2 with a coded error, not a crash', async t => {
  const dir = await journalDir(t, {});
  const script = fileURLToPath(new URL('../scripts/journal-aggregate.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script, '--bogus'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /E_JOURNAL_ARGV/);
  assert.ok(!r.stderr.includes('exitSync')); // R03: no TypeError crash path
});

test('aggregateJournals reads a real directory end to end', async t => {
  const dir = await journalDir(t, {
    'A.reserved.json': reserved('A'),
    'A.result.json': result('A'),
    'notes.txt': 'ignored',
  });
  const s = await aggregateJournals({ directory: dir, scopeMap: { T1: 'execution' } });
  assert.equal(s.attempts, 1);
  assert.equal(s.scopes.execution.totals.completed, 1);
});
