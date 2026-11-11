import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkEnvelope, validateEnvelope } from '../scripts/envelope-check.mjs';

const summary = (over = {}) => ({ version: 1, attempts: 3, unscopedAttempts: 0, unreconciledAttempts: 3,
  scopes: {}, totals: { attempts: 3, completed: 2, incomplete: 1, failed: 0, unknown: 0, unsettled: 0,
    usageUnknownAttempts: 1, inputTokens: 5000, outputTokens: 2000, cachedInputTokens: 0,
    reasoningOutputTokens: 100, estimatedUsd: '0.020000000', reservedUsd: '2.000000000',
    estimatedUsdUnknownAttempts: 1, reservedUsdUnknownAttempts: 0 }, ...over });
const envelope = { maxRequests: 5, totalCapUsd: '10' };
const code = expected => e => e.code === expected;

test('a planned request inside the envelope passes with exact remaining figures', () => {
  const r = checkEnvelope({ envelope, summary: summary(), plannedReservedUsd: '0.786432000' });
  assert.equal(r.ok, true);
  assert.equal(r.usedRequests, 3);
  assert.equal(r.remainingRequests, 2);
  assert.equal(r.heldUsd, '2.000000000');
  assert.equal(r.remainingUsd, '8.000000000');
  assert.equal(r.knownEstimatedUsd, '0.020000000');
  assert.equal(r.unknowns.usageUnknownAttempts, 1);
});

test('exhausted request count blocks with E_ENVELOPE_REQUESTS', () => {
  const s = summary(); s.totals = { ...s.totals, attempts: 5 }; s.attempts = 5;
  const r = checkEnvelope({ envelope, summary: s, plannedReservedUsd: '0.786432000' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'E_ENVELOPE_REQUESTS');
  assert.match(r.reason, /fresh user authority/);
});

test('a reservation larger than the remaining budget blocks with E_ENVELOPE_BUDGET', () => {
  const r = checkEnvelope({ envelope: { maxRequests: 5, totalCapUsd: '2.5' }, summary: summary(), plannedReservedUsd: '0.786432000' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'E_ENVELOPE_BUDGET');
  assert.equal(r.remainingUsd, '0.500000000');
});

test('unknown held reservations block instead of guessing', () => {
  const s = summary(); s.totals = { ...s.totals, reservedUsd: null, reservedUsdUnknownAttempts: 3 };
  const r = checkEnvelope({ envelope, summary: s, plannedReservedUsd: '0.786432000' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'E_ENVELOPE_UNKNOWN');
});

test('an empty journal means exactly zero held, not unknown (F-KIMI-02)', () => {
  const s = summary({ attempts: 0, unreconciledAttempts: 0, usageUnknownAttempts: 0, estimatedUsdUnknownAttempts: 0, reservedUsdUnknownAttempts: 0 });
  s.totals = { ...s.totals, attempts: 0, completed: 0, incomplete: 0, failed: 0, unknown: 0, unsettled: 0,
    usageUnknownAttempts: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0,
    estimatedUsd: null, reservedUsd: null, estimatedUsdUnknownAttempts: 0, reservedUsdUnknownAttempts: 0 };
  const r = checkEnvelope({ envelope, summary: s, plannedReservedUsd: '0.786432000' });
  assert.equal(r.ok, true);
  assert.equal(r.usedRequests, 0);
  assert.equal(r.remainingRequests, 5);
  assert.equal(r.heldUsd, '0.000000000');
  assert.equal(r.remainingUsd, '10.000000000');
});

test('malformed envelopes and reservations are rejected', () => {
  assert.throws(() => validateEnvelope({ maxRequests: 0, totalCapUsd: '1' }), code('E_ENVELOPE'));
  assert.throws(() => validateEnvelope({ maxRequests: 1, totalCapUsd: 'lots' }), code('E_ENVELOPE'));
  assert.throws(() => validateEnvelope({ maxRequests: 1, totalCapUsd: '1', extra: 1 }), code('E_ENVELOPE'));
  assert.throws(() => checkEnvelope({ envelope, summary: summary(), plannedReservedUsd: '-1' }), code('E_ENVELOPE'));
});

const script = fileURLToPath(new URL('../scripts/envelope-check.mjs', import.meta.url));
test('CLI checks a real journal directory and blocks an exhausted envelope', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'k6-env-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const rec = { version: 1, approvalId: 'A', provider: 'deepseek', taskId: 'T', model: 'deepseek-flash',
    status: 'completed', reservedUsd: '0.786432000', estimatedUsd: '0.010000000', actualChargeUsd: null,
    candidateSha256: 'a'.repeat(64), requestSha256: 'b'.repeat(64),
    usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 15 } };
  await writeFile(path.join(dir, 'A.result.json'), JSON.stringify(rec), { mode: 0o600 });
  const envFile = path.join(dir, 'env.json');
  await writeFile(envFile, JSON.stringify({ maxRequests: 1, totalCapUsd: '10' }), { mode: 0o600 });
  const r = spawnSync(process.execPath, [script, '--journal-dir', dir, '--envelope', envFile,
    '--planned-reservation', '0.786432000'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.equal(JSON.parse(r.stdout).code, 'E_ENVELOPE_REQUESTS');
});
