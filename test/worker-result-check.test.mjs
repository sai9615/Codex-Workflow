import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateWorkerResult, WorkerResultError } from '../scripts/worker-result-check.mjs';

const valid = () => ({ version: 1, taskId: 'NW020-K4', role: 'development', verdict: 'pass',
  artifacts: [{ path: 'scripts/x.mjs', sha256: 'a'.repeat(64) }],
  tests: { executed: 13, passed: 13, failed: 0, evidence: 'run/tests.txt' },
  usage: { inputTokens: 100, outputTokens: 50, estimatedUsd: '0.005' },
  findings: [], blockers: [] });

const code = expected => e => e instanceof WorkerResultError && e.code === expected;

test('a complete passing result validates', () => {
  assert.deepEqual(validateWorkerResult(valid()), { ok: true });
});

test('a PASS without artifacts or executed tests cannot stand', () => {
  const noArtifacts = valid(); noArtifacts.artifacts = [];
  assert.throws(() => validateWorkerResult(noArtifacts), code('E_EVIDENCE'));
  const noTests = valid(); noTests.tests = { executed: 0, passed: 0, failed: 0, evidence: 'none' };
  assert.throws(() => validateWorkerResult(noTests), code('E_EVIDENCE'));
});

test('fail and blocked verdicts require their own support', () => {
  const failNoFindings = valid(); failNoFindings.verdict = 'fail'; failNoFindings.findings = [];
  assert.throws(() => validateWorkerResult(failNoFindings), code('E_EVIDENCE'));
  const failOk = valid(); failOk.verdict = 'fail';
  failOk.findings = [{ id: 'F-1', severity: 'major', location: 'x.mjs:10', summary: 'off by one' }];
  assert.deepEqual(validateWorkerResult(failOk), { ok: true });
  const blockedNoReason = valid(); blockedNoReason.verdict = 'blocked'; blockedNoReason.blockers = [];
  assert.throws(() => validateWorkerResult(blockedNoReason), code('E_EVIDENCE'));
});

test('malformed shapes, hashes, sums and money are rejected', () => {
  for (const mutate of [
    r => { r.smuggle = 1; },
    r => { r.version = 2; },
    r => { r.role = 'boss'; },
    r => { r.verdict = 'maybe'; },
    r => { r.artifacts = [{ path: 'x', sha256: 'not-hex' }]; },
    r => { r.tests = { executed: 2, passed: 1, failed: 0, evidence: 'e' }; }, // sum mismatch
    r => { r.usage = { inputTokens: -1, outputTokens: 0, estimatedUsd: '0' }; },
    r => { r.usage = { inputTokens: 0, outputTokens: 0, estimatedUsd: 'cheap' }; },
    r => { r.findings = [{ id: '', severity: 'major', location: 'x', summary: 'y' }]; },
    r => { r.findings = [{ id: 'F', severity: 'catastrophic', location: 'x', summary: 'y' }]; },
  ]) {
    const r = valid(); mutate(r);
    assert.throws(() => validateWorkerResult(r), code('E_RESULT'));
  }
});

test('usage may be null (unknown) but never partially missing', () => {
  const r = valid(); r.usage = null;
  assert.deepEqual(validateWorkerResult(r), { ok: true });
});

const script = fileURLToPath(new URL('../scripts/worker-result-check.mjs', import.meta.url));
test('CLI validates a file and rejects an unsupported PASS with exit 2', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'k4-wr-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const good = path.join(dir, 'good.json');
  await writeFile(good, JSON.stringify(valid()), { mode: 0o600 });
  const r1 = spawnSync(process.execPath, [script, '--result', good], { encoding: 'utf8' });
  assert.equal(r1.status, 0, r1.stderr);
  assert.deepEqual(JSON.parse(r1.stdout), { ok: true, taskId: 'NW020-K4', verdict: 'pass' });
  const bad = path.join(dir, 'bad.json');
  const unsupported = valid(); unsupported.artifacts = [];
  await writeFile(bad, JSON.stringify(unsupported), { mode: 0o600 });
  const r2 = spawnSync(process.execPath, [script, '--result', bad], { encoding: 'utf8' });
  assert.equal(r2.status, 2); assert.match(r2.stderr, /E_EVIDENCE/);
});
