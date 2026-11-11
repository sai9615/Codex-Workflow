import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { mkdtemp, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { aggregateJournals, summarizeAttempts } from '../scripts/journal-aggregate.mjs';
import { checkEnvelope } from '../scripts/envelope-check.mjs';
import { validateWorkerResult, WorkerResultError } from '../scripts/worker-result-check.mjs';
import { planAllowance, ANSWER_HEADROOM_TOKENS, FINAL_ANSWER_RESERVE, BUDGET_CEILINGS } from '../scripts/worker-budget.mjs';
import { prepareRequest, planRequest, runRequest } from '../scripts/deepseek-worker.mjs';

https.request = () => { throw new Error('network disabled in review regressions'); };
https.get = () => { throw new Error('network disabled in review regressions'); };

const NOW = Date.UTC(2026, 10, 6, 21);
const iso = x => new Date(x).toISOString();
const KEY = 'sk-synthetic-only-not-a-real-credential';
const PRICE_SOURCE = 'https://api-docs.deepseek.com/';

async function tempDir(t) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'review-regress-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function journalRecord(approvalId, provider, taskId, model, status, overrides = {}) {
  return {
    version: 1,
    approvalId,
    provider,
    taskId,
    model,
    status,
    candidateSha256: 'a'.repeat(64),
    requestSha256: 'b'.repeat(64),
    usage: status === 'reserved' ? null : { inputTokens: 10, outputTokens: 5, cachedInputTokens: 2, reasoningOutputTokens: 1, totalTokens: 15 },
    reservedUsd: null,
    estimatedUsd: null,
    actualChargeUsd: null,
    ...overrides,
  };
}

async function writeJournal(dir, base, kind, record) {
  await writeFile(join(dir, base + '.' + kind + '.json'), JSON.stringify(record), 'utf8');
}

async function writeCompletePair(dir, id, options = {}) {
  const {
    provider = 'deepseek',
    taskId = 'task-x',
    model = 'deepseek-flash',
    reservedUsd = '1.000000000',
    resultReservedUsd = reservedUsd,
    estimatedUsd = '0.000001000',
  } = options;
  const meta = {
    version: 1,
    approvalId: id,
    provider,
    taskId,
    model,
    candidateSha256: 'a'.repeat(64),
    requestSha256: 'b'.repeat(64),
  };
  await writeJournal(dir, id, 'reserved', { ...meta, status: 'reserved', reservedUsd, actualChargeUsd: null });
  await writeJournal(dir, id, 'result', {
    ...meta,
    status: 'completed',
    usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 2, reasoningOutputTokens: 1, totalTokens: 15 },
    reservedUsd: resultReservedUsd,
    estimatedUsd,
    actualChargeUsd: null,
  });
}

function normalizedResult(overrides = {}) {
  return {
    fileKind: 'result',
    approvalId: 'dup',
    provider: 'deepseek',
    taskId: 'dup-task',
    model: 'deepseek-flash',
    candidateSha256: 'a'.repeat(64),
    requestSha256: 'b'.repeat(64),
    status: 'completed',
    usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 2, reasoningOutputTokens: 1, totalTokens: 15 },
    estimatedUsd: 1000n,
    reservedUsd: 2000n,
    actualChargeUsd: null,
    ...overrides,
  };
}

function emptyTotals() {
  return {
    attempts: 0,
    completed: 0,
    incomplete: 0,
    failed: 0,
    unknown: 0,
    unsettled: 0,
    usageUnknownAttempts: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningOutputTokens: 0,
    estimatedUsd: null,
    reservedUsd: null,
    estimatedUsdUnknownAttempts: 0,
    reservedUsdUnknownAttempts: 0,
  };
}

function emptySummary() {
  return {
    attempts: 0,
    unreconciledAttempts: 0,
    totals: emptyTotals(),
  };
}

function makeRequest(overrides = {}) {
  return {
    version: 1,
    provider: 'deepseek',
    taskId: 'offline-case',
    candidateSha256: 'a'.repeat(64),
    role: 'testing',
    model: 'deepseek-flash',
    effort: 'none',
    instructions: 'Generate a test plan only.',
    input: [{ role: 'user', content: 'Review the supplied pure function.' }],
    maxOutputTokens: 128,
    timeoutMs: 1000,
    ...overrides,
  };
}

function makeApproval(request, id = 'grant-r4') {
  const prepared = prepareRequest(request);
  return {
    version: 1,
    id,
    approved: true,
    taskId: request.taskId,
    candidateSha256: request.candidateSha256,
    requestSha256: prepared.requestSha256,
    expiresAt: iso(NOW + 900000),
    maxRequests: 1,
    maxUsd: '10',
    pricing: {
      verified: true,
      model: request.model,
      currency: 'USD',
      source: PRICE_SOURCE,
      verifiedAt: iso(NOW - 1000),
      expiresAt: iso(NOW + 900000),
      inputMissUsdPerMillion: '2',
      inputHitUsdPerMillion: '0.5',
      outputUsdPerMillion: '3',
      billingInputTokenCeiling: 1048576,
      billingOutputTokenCeiling: 393216,
    },
  };
}

function workerPass() {
  return {
    version: 1,
    taskId: 'review-task',
    role: 'review',
    verdict: 'pass',
    artifacts: [{ path: 'review-report.md', sha256: 'a'.repeat(64) }],
    tests: { executed: 1, passed: 1, failed: 0, evidence: 'synthetic review log hash and test output' },
    usage: { inputTokens: 10, outputTokens: 2, estimatedUsd: '0.000001000' },
    findings: [],
    blockers: [],
  };
}

test('R1 actual CLI empty journal is genuinely consistent and permits envelope', async (t) => {
  const dir = await tempDir(t);
  const script = fileURLToPath(new URL('../scripts/journal-aggregate.mjs', import.meta.url));
  const cli = spawnSync(process.execPath, [script, '--journal-dir', dir], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const summary = JSON.parse(cli.stdout);
  assert.equal(summary.attempts, 0);
  assert.equal(summary.unscopedAttempts, 0);
  assert.equal(summary.unreconciledAttempts, 0);
  assert.deepEqual(summary.totals, emptyTotals());
  const r = checkEnvelope({ envelope: { maxRequests: 5, totalCapUsd: '10' }, summary, plannedReservedUsd: '0.786432000' });
  assert.equal(r.ok, true);
  assert.equal(r.usedRequests, 0);
  assert.equal(r.remainingRequests, 5);
  assert.equal(r.heldUsd, '0.000000000');
  assert.equal(r.remainingUsd, '10.000000000');
});

test('R1 actual CLI mixed partial unknown held reservations block envelope', async (t) => {
  const dir = await tempDir(t);
  await writeCompletePair(dir, 'known', { reservedUsd: '1.000000000' });
  await writeJournal(dir, 'unknown-reservation', 'result', journalRecord(
    'unknown-reservation', 'deepseek', 'task-unknown', 'deepseek-flash', 'completed',
    { reservedUsd: null, estimatedUsd: '0.000002000', actualChargeUsd: null },
  ));
  const script = fileURLToPath(new URL('../scripts/journal-aggregate.mjs', import.meta.url));
  const cli = spawnSync(process.execPath, [script, '--journal-dir', dir], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const summary = JSON.parse(cli.stdout);
  assert.equal(summary.attempts, 2);
  assert.equal(summary.totals.reservedUsdUnknownAttempts, 1);
  assert.equal(summary.totals.reservedUsd, '1.000000000');
  const r = checkEnvelope({ envelope: { maxRequests: 5, totalCapUsd: '10' }, summary, plannedReservedUsd: '0.01' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'E_ENVELOPE_UNKNOWN');
});

test('R1 fully unknown held reservations block as unknown and zero-estimate empty summary fails closed', () => {
  const envelope = { maxRequests: 5, totalCapUsd: '10' };
  const full = emptySummary();
  full.attempts = 1;
  full.unreconciledAttempts = 0;
  full.totals.attempts = 1;
  full.totals.completed = 1;
  full.totals.estimatedUsd = '0.000001000';
  full.totals.reservedUsdUnknownAttempts = 1;
  const unknown = checkEnvelope({ envelope, summary: full, plannedReservedUsd: '0.01' });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, 'E_ENVELOPE_UNKNOWN');

  const zeroEstimate = emptySummary();
  zeroEstimate.totals.estimatedUsd = '0.000000001';
  assert.throws(() => checkEnvelope({ envelope, summary: zeroEstimate, plannedReservedUsd: '0.01' }), (error) => error?.code === 'E_ENVELOPE');
});

test('R1 malformed negative missing counters and summary/totals mismatch fail closed', () => {
  const envelope = { maxRequests: 5, totalCapUsd: '10' };
  const negative = emptySummary();
  negative.totals.usageUnknownAttempts = -1;
  assert.throws(() => checkEnvelope({ envelope, summary: negative, plannedReservedUsd: '0.01' }), (error) => error?.code === 'E_ENVELOPE');

  const missing = emptySummary();
  delete missing.totals.usageUnknownAttempts;
  assert.throws(() => checkEnvelope({ envelope, summary: missing, plannedReservedUsd: '0.01' }), (error) => error?.code === 'E_ENVELOPE');

  const mismatch = emptySummary();
  mismatch.attempts = 1;
  assert.throws(() => checkEnvelope({ envelope, summary: mismatch, plannedReservedUsd: '0.01' }), (error) => error?.code === 'E_ENVELOPE');
});

test('R1 known held liabilities allow dispatch even when actual bill is unknown', async (t) => {
  const dir = await tempDir(t);
  await writeCompletePair(dir, 'known-bill-unknown', { reservedUsd: '1.000000000', estimatedUsd: '0.000001000' });
  const summary = await aggregateJournals({ directory: dir });
  assert.equal(summary.unreconciledAttempts, 1);
  const r = checkEnvelope({ envelope: { maxRequests: 5, totalCapUsd: '10' }, summary, plannedReservedUsd: '0.5' });
  assert.equal(r.ok, true);
  assert.equal(r.heldUsd, '1.000000000');
  assert.equal(r.remainingRequests, 4);
});

test('R2 pass rejects failed tests, blockers, and each blocking finding severity', () => {
  const failedTests = workerPass();
  failedTests.tests = { executed: 1, passed: 0, failed: 1, evidence: 'synthetic failed test log' };
  assert.throws(() => validateWorkerResult(failedTests), (error) => error instanceof WorkerResultError && error.code === 'E_EVIDENCE');

  const blockers = workerPass();
  blockers.blockers = ['missing execution record'];
  assert.throws(() => validateWorkerResult(blockers), (error) => error instanceof WorkerResultError && error.code === 'E_EVIDENCE');

  for (const severity of ['critical', 'major', 'minor']) {
    const blocked = workerPass();
    blocked.findings = [{ id: 'F-' + severity, severity, location: 'review-regressions.test.mjs', summary: 'synthetic blocking finding' }];
    assert.throws(() => validateWorkerResult(blocked), (error) => error instanceof WorkerResultError && error.code === 'E_EVIDENCE');
  }

  const noted = workerPass();
  noted.findings = [{ id: 'N-1', severity: 'note', location: 'review-regressions.test.mjs', summary: 'nonblocking note' }];
  assert.equal(validateWorkerResult(noted).ok, true);
});

test('R3 fresh distinct approvals count twice with reserved/result pairs and exact token subsets', async (t) => {
  const dir = await tempDir(t);
  await writeCompletePair(dir, 'grant-1');
  await writeCompletePair(dir, 'grant-2');
  const summary = await aggregateJournals({ directory: dir });
  assert.equal(summary.attempts, 2);
  assert.equal(summary.totals.completed, 2);
  assert.equal(summary.totals.unsettled, 0);
  assert.equal(summary.totals.inputTokens, 20);
  assert.equal(summary.totals.outputTokens, 10);
  assert.equal(summary.totals.cachedInputTokens, 4);
  assert.equal(summary.totals.reasoningOutputTokens, 2);
  assert.equal(summary.totals.reservedUsd, '2.000000000');
});

test('R3 same approval id with different providers remains separate in normalized pipeline', async (t) => {
  const dir = await tempDir(t);
  const approval = 'multi-provider';
  const meta = (provider, model) => ({
    version: 1,
    approvalId: approval,
    provider,
    taskId: 'task-x',
    model,
    candidateSha256: 'a'.repeat(64),
    requestSha256: 'b'.repeat(64),
  });
  await writeJournal(dir, approval, 'reserved', { ...meta('deepseek', 'deepseek-flash'), status: 'reserved', reservedUsd: '1.000000000', actualChargeUsd: null });
  await writeJournal(dir, approval, 'result', {
    ...meta('openai', 'deepseek-flash'),
    status: 'completed',
    usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 2, reasoningOutputTokens: 1, totalTokens: 15 },
    reservedUsd: '1.000000000',
    estimatedUsd: '0.000001000',
    actualChargeUsd: null,
  });
  const summary = await aggregateJournals({ directory: dir });
  assert.equal(summary.attempts, 2);
  assert.equal(summary.totals.unsettled, 1);
  assert.equal(summary.totals.completed, 1);
});

test('R3 actual loader rejects same approval/provider conflicting task/model/candidate/request metadata', async (t) => {
  const conflicts = {
    taskId: 'task-b',
    model: 'deepseek-v4-pro',
    candidateSha256: 'c'.repeat(64),
    requestSha256: 'd'.repeat(64),
  };
  for (const [field, changed] of Object.entries(conflicts)) {
    const dir = await tempDir(t);
    const base = {
      version: 1,
      approvalId: 'conflict',
      provider: 'deepseek',
      taskId: 'task-a',
      model: 'deepseek-flash',
      candidateSha256: 'a'.repeat(64),
      requestSha256: 'b'.repeat(64),
    };
    const conflicting = { ...base, [field]: changed };
    await writeJournal(dir, `conflict-${field}`, 'reserved', { ...base, status: 'reserved', reservedUsd: '1.000000000', actualChargeUsd: null });
    await writeJournal(dir, `conflict-${field}`, 'result', {
      ...conflicting,
      status: 'completed',
      usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 2, reasoningOutputTokens: 1, totalTokens: 15 },
      reservedUsd: '1.000000000',
      estimatedUsd: '0.000001000',
      actualChargeUsd: null,
    });
    await assert.rejects(() => aggregateJournals({ directory: dir }), (error) => error?.code === 'E_JOURNAL_METADATA_MISMATCH');
  }
});

test('R3 duplicate same-kind result attempts are rejected', () => {
  assert.throws(() => summarizeAttempts([normalizedResult(), normalizedResult()]), (error) => error?.code === 'E_JOURNAL_DUPLICATE');
});

test('R3 result cannot shrink reservation and null result inherits known reserve', async (t) => {
  const dir = await tempDir(t);
  await writeCompletePair(dir, 'shrink', { reservedUsd: '1.000000000', resultReservedUsd: '0.500000000' });
  await writeCompletePair(dir, 'inherit', { reservedUsd: '2.000000000', resultReservedUsd: null });
  const summary = await aggregateJournals({ directory: dir });
  assert.equal(summary.totals.reservedUsd, '3.000000000');
  assert.equal(summary.totals.reservedUsdUnknownAttempts, 0);
});

test('R3 negative held reservation is rejected by the real loader', async (t) => {
  const dir = await tempDir(t);
  await writeJournal(dir, 'negative-reservation', 'reserved', journalRecord(
    'negative-reservation', 'deepseek', 'task-negative', 'deepseek-flash', 'reserved',
    { reservedUsd: '-0.000000001', actualChargeUsd: null },
  ));
  await assert.rejects(() => aggregateJournals({ directory: dir }), (error) => error?.code === 'E_JOURNAL_MONEY');
});

test('R4 allowance headroom is advisory and legacy alias does not invent a provider partition', () => {
  const p = planAllowance({ role: 'development', model: 'deepseek-flash', effort: 'high', complexity: 'complex', risk: 'high' });
  assert.equal(p.answerHeadroomTokens, ANSWER_HEADROOM_TOKENS);
  assert.equal(p.reserveFinalAnswer, FINAL_ANSWER_RESERVE);
  assert.equal(ANSWER_HEADROOM_TOKENS, FINAL_ANSWER_RESERVE);
  assert.equal(BUDGET_CEILINGS.maxOutputTokens, 65536);
  assert.equal(BUDGET_CEILINGS.timeoutMs, 600000);
});

test('R4 actual runRequest returns incomplete for all-reasoning output and blocks replay without retry', async (t) => {
  const dir = await tempDir(t);
  const request = makeRequest({
    effort: 'high',
    maxOutputTokens: 32768,
    timeoutMs: 600000,
    budgetJustification: 'synthetic high reasoning allowance for regression',
  });
  const approval = makeApproval(request, 'grant-r4');
  const plan = planRequest(request, approval, NOW);
  let calls = 0;
  let keyReads = 0;
  const transport = async () => {
    calls += 1;
    return {
      statusCode: 200,
      bodyString: JSON.stringify({
        id: 'synthetic-r4-response',
        model: 'deepseek-flash',
        status: 'incomplete',
        output: [{ type: 'reasoning' }],
        usage: {
          input_tokens: 10,
          input_tokens_details: { cached_tokens: 2 },
          output_tokens: 32768,
          output_tokens_details: { reasoning_tokens: 32768 },
          total_tokens: 32778,
        },
      }),
    };
  };
  const getCredential = async () => {
    keyReads += 1;
    return KEY;
  };
  const options = { request, approval, execute: true, journalDirectory: dir, now: () => NOW, getCredential, transport };
  const result = await runRequest(options);
  assert.equal(calls, 1);
  assert.equal(keyReads, 1);
  assert.equal(result.status, 'incomplete');
  assert.equal(result.code, 'E_INCOMPLETE');
  assert.equal(result.usage.outputTokens, 32768);
  assert.equal(result.usage.reasoningOutputTokens, 32768);
  assert.equal(result.reservedUsd, plan.preview.reservedUsd);

  const reserved = JSON.parse(await readFile(join(dir, 'grant-r4.reserved.json'), 'utf8'));
  const journalResult = JSON.parse(await readFile(join(dir, 'grant-r4.result.json'), 'utf8'));
  assert.equal(journalResult.status, 'incomplete');
  assert.equal(journalResult.usage.outputTokens, 32768);
  assert.equal(journalResult.usage.reasoningOutputTokens, 32768);
  assert.equal(journalResult.reservationDisposition, 'held; reconcile with provider before any new authorization');

  await assert.rejects(() => runRequest(options), (error) => error?.code === 'E_ATTEMPT_USED');
  assert.equal(calls, 1);
  assert.equal(keyReads, 1);
});


test('R3 real loader separates pipe-delimited identifiers that previously collided in attemptKey', async (t) => {
  const dir = await tempDir(t);
  await writeJournal(dir, 'pipe-reserved', 'reserved', journalRecord(
    'A|B', 'deepseek', 'C', 'deepseek-flash', 'reserved',
    { reservedUsd: '1.000000000', actualChargeUsd: null },
  ));
  await writeJournal(dir, 'pipe-result', 'result', journalRecord(
    'A', 'deepseek', 'B|C', 'deepseek-flash', 'completed',
    { reservedUsd: '1.000000000', estimatedUsd: '0.000001000', actualChargeUsd: null },
  ));
  const summary = await aggregateJournals({ directory: dir });
  assert.equal(summary.attempts, 2);
  assert.equal(summary.totals.reservedUsd, '2.000000000');
});

test('R3 real loader separates approval/provider scopes containing NUL separators', async (t) => {
  const dir = await tempDir(t);
  await writeJournal(dir, 'nul-scope-one', 'reserved', journalRecord(
    'a\u0000b', 'c', 'task-t', 'deepseek-flash', 'reserved',
    { reservedUsd: '1.000000000', actualChargeUsd: null },
  ));
  await writeJournal(dir, 'nul-scope-two', 'reserved', journalRecord(
    'a', 'b\u0000c', 'task-other', 'deepseek-flash', 'reserved',
    { reservedUsd: '1.000000000', actualChargeUsd: null },
  ));
  const summary = await aggregateJournals({ directory: dir });
  assert.equal(summary.attempts, 2);
  assert.equal(summary.totals.reservedUsd, '2.000000000');
});

test('R3 real loader rejects separator-ambiguous conflicting metadata inside a scope', async (t) => {
  const dir = await tempDir(t);
  const base = {
    version: 1,
    approvalId: 'ambiguous-scope',
    provider: 'deepseek',
    candidateSha256: 'a'.repeat(64),
    requestSha256: 'b'.repeat(64),
  };
  await writeJournal(dir, 'tuple-one', 'reserved', {
    ...base,
    taskId: 'A\u0000B',
    model: 'C',
    status: 'reserved',
    reservedUsd: '1.000000000',
    actualChargeUsd: null,
  });
  await writeJournal(dir, 'tuple-two', 'reserved', {
    ...base,
    taskId: 'A',
    model: 'B\u0000C',
    status: 'reserved',
    reservedUsd: '1.000000000',
    actualChargeUsd: null,
  });
  await assert.rejects(() => aggregateJournals({ directory: dir }), (error) => error?.code === 'E_JOURNAL_METADATA_MISMATCH');
});


test('R3 real loader keeps NUL-containing provider/model pairs distinct within the same scope', async (t) => {
  const dir = await tempDir(t);
  await writeJournal(dir, 'nul-pair-a', 'result', journalRecord(
    'approval-nul-a', 'b\u0000c', 'task-nul-a', 'd', 'completed',
    { reservedUsd: '1.000000000', estimatedUsd: '0.000001000', usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 2, reasoningOutputTokens: 1, totalTokens: 15 } },
  ));
  await writeJournal(dir, 'nul-pair-b', 'result', journalRecord(
    'approval-nul-b', 'b', 'task-nul-b', 'c\u0000d', 'completed',
    { reservedUsd: '1.000000000', estimatedUsd: '0.000001000', usage: { inputTokens: 20, outputTokens: 3, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 23 } },
  ));
  const summary = await aggregateJournals({ directory: dir, scopeMap: { 'task-nul-a': 'preparation', 'task-nul-b': 'preparation' } });
  assert.equal(summary.attempts, 2);
  const providers = summary.scopes.preparation.providers;
  assert.deepEqual(Object.keys(providers).sort(), ['b', 'b\u0000c']);
  assert.equal(providers['b\u0000c'].d.inputTokens, 10);
  assert.equal(providers['b\u0000c'].d.outputTokens, 5);
  assert.equal(providers['b']['c\u0000d'].inputTokens, 20);
  assert.equal(providers['b']['c\u0000d'].outputTokens, 3);
  assert.equal(summary.scopes.preparation.totals.inputTokens, 30);
  assert.equal(summary.scopes.preparation.totals.outputTokens, 8);
  assert.equal(summary.totals.inputTokens, 30);
  assert.equal(summary.totals.outputTokens, 8);
});

test('R3 real loader rejects negative estimatedUsd as E_JOURNAL_MONEY', async (t) => {
  const dir = await tempDir(t);
  await writeJournal(dir, 'negative-estimate', 'result', journalRecord(
    'negative-estimate', 'deepseek', 'task-negative-estimate', 'deepseek-flash', 'completed',
    { reservedUsd: '1.000000000', estimatedUsd: '-0.000000001' },
  ));
  await assert.rejects(
    () => aggregateJournals({ directory: dir }),
    (error) => error?.code === 'E_JOURNAL_MONEY',
  );
});

test('R4 envelope overcap one nanodollar returns valid signed decimal amounts', () => {
  const summary = emptySummary();
  summary.attempts = 1;
  summary.totals.attempts = 1;
  summary.totals.reservedUsd = '1.000000001';
  const result = checkEnvelope({
    envelope: { maxRequests: 5, totalCapUsd: '1.000000000' },
    summary,
    plannedReservedUsd: '0.000000000',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'E_ENVELOPE_BUDGET');
  assert.equal(result.heldUsd, '1.000000001');
  assert.equal(result.remainingUsd, '-0.000000001');
  assert.match(result.remainingUsd, /^-\d+\.\d{9}$/);
});

test('R3 aggregate loader isolates special identifier key probes without prototype mutation', () => {
  const journalUrl = new URL('../scripts/journal-aggregate.mjs', import.meta.url).href;
  const script = `
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregateJournals } from ${JSON.stringify(journalUrl)};

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const keySnapshot = (target) => JSON.stringify(Reflect.ownKeys(target).map((key) => key.toString()).sort());

const original = {
  objectProtoKeys: keySnapshot(Object.prototype),
  functionProtoKeys: keySnapshot(Function.prototype),
  objectConstructorKeys: keySnapshot(Object),
  objectToString: Object.prototype.toString,
  objectHasOwnProperty: Object.prototype.hasOwnProperty,
  objectConstructor: Object.prototype.constructor,
  functionPrototypeConstructor: Function.prototype.constructor,
};

const baseDir = await mkdtemp(join(tmpdir(), 'review-proto-probe-'));

const record = (file, approvalId, provider, taskId, model, inputTokens, outputTokens) => ({
  file,
  version: 1,
  approvalId,
  provider,
  taskId,
  model,
  status: 'completed',
  candidateSha256: 'a'.repeat(64),
  requestSha256: 'b'.repeat(64),
  usage: { inputTokens, outputTokens, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: inputTokens + outputTokens },
  reservedUsd: '1.000000000',
  estimatedUsd: '0.000001000',
  actualChargeUsd: null,
});

try {
  const cases = [
    record('probe-1', 'approval-proto', '__proto__', '__proto__', 'constructor', 11, 1),
    record('probe-2', 'approval-constructor', 'toString', 'constructor', 'hasOwnProperty', 13, 2),
    record('probe-3', 'approval-toString', 'hasOwnProperty', 'toString', '__proto__', 17, 3),
    record('probe-4', 'approval-hasOwnProperty', 'constructor', 'hasOwnProperty', 'toString', 19, 4),
  ];
  const scopeMap = {};
  for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    Object.defineProperty(scopeMap, key, { value: 'preparation', enumerable: true, configurable: true, writable: true });
  }
  assert(Object.prototype.hasOwnProperty.call(scopeMap, '__proto__'), 'scopeMap should contain own __proto__ entry');

  for (const item of cases) {
    await writeFile(join(baseDir, item.file + '.result.json'), JSON.stringify(item), 'utf8');
  }
  const summary = await aggregateJournals({ directory: baseDir, scopeMap });
  assert(summary.unscopedAttempts === 0, 'special task IDs should map via scopeMap');
  const providers = summary.scopes.preparation.providers;
  for (const item of cases) {
    const models = providers[item.provider];
    assert(models && Object.prototype.hasOwnProperty.call(providers, item.provider), 'missing own provider entry ' + item.provider);
    assert(models && Object.prototype.hasOwnProperty.call(models, item.model) && models[item.model].inputTokens === item.usage.inputTokens, 'missing own model entry ' + item.provider + '/' + item.model);
  }
  const roundTrip = JSON.parse(JSON.stringify(summary));
  const rtProviders = roundTrip.scopes.preparation.providers;
  for (const item of cases) {
    assert(Object.prototype.hasOwnProperty.call(rtProviders, item.provider), 'round-trip missing own provider ' + item.provider);
    assert(Object.prototype.hasOwnProperty.call(rtProviders[item.provider], item.model), 'round-trip missing own model ' + item.provider + '/' + item.model);
  }

  const approvalDir = await mkdtemp(join(tmpdir(), 'review-approval-probe-'));
  try {
    const approvalRecord = record('special-approval', '__proto__', 'deepseek', 'normal-task', 'deepseek-flash', 23, 5);
    await writeFile(join(approvalDir, 'special-approval.result.json'), JSON.stringify(approvalRecord), 'utf8');
    const approvalScope = {};
    Object.defineProperty(approvalScope, '__proto__', { value: 'execution', enumerable: true, configurable: true, writable: true });
    const approvalSummary = await aggregateJournals({ directory: approvalDir, scopeMap: approvalScope });
    assert(approvalSummary.unscopedAttempts === 0, 'special approval ID should map through approval scope key');
    assert(Boolean(approvalSummary.scopes.execution), 'special approval ID journal should resolve to execution scope');
  } finally {
    await rm(approvalDir, { recursive: true, force: true });
  }

  const inheritedDir = await mkdtemp(join(tmpdir(), 'review-inherited-probe-'));
  try {
    const inheritedRecord = record('inherited-task', 'approval-inherited', 'deepseek', 'inherited-task', 'deepseek-flash', 29, 6);
    await writeFile(join(inheritedDir, 'inherited-task.result.json'), JSON.stringify(inheritedRecord), 'utf8');
    const inheritedProto = {};
    Object.defineProperty(inheritedProto, 'inherited-task', { value: 'preparation', enumerable: true, configurable: true, writable: true });
    const inheritedScope = Object.create(inheritedProto);
    const inheritedSummary = await aggregateJournals({ directory: inheritedDir, scopeMap: inheritedScope });
    assert(inheritedSummary.unscopedAttempts === 1, 'inherited scopeMap entries must not resolve');
  } finally {
    await rm(inheritedDir, { recursive: true, force: true });
  }

  assert(original.objectProtoKeys === keySnapshot(Object.prototype), 'Object.prototype keys mutated');
  assert(original.functionProtoKeys === keySnapshot(Function.prototype), 'Function.prototype keys mutated');
  assert(original.objectConstructorKeys === keySnapshot(Object), 'Object constructor keys mutated');
  assert(original.objectToString === Object.prototype.toString, 'Object.prototype.toString mutated');
  assert(original.objectHasOwnProperty === Object.prototype.hasOwnProperty, 'Object.prototype.hasOwnProperty mutated');
  assert(original.objectConstructor === Object.prototype.constructor, 'Object.prototype.constructor mutated');
  assert(original.functionPrototypeConstructor === Function.prototype.constructor, 'Function.prototype.constructor mutated');
} finally {
  await rm(baseDir, { recursive: true, force: true });
}
`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env } });
  assert.equal(child.status, 0, child.stderr || child.stdout);
});

// Coordinator verification of the directly exported API, in addition to loader tests.
test('direct scopeMap lookup ignores inherited names and preserves own task and approval keys', () => {
  const rec = normalizedResult({ taskId: 'constructor' });
  const inherited = Object.create({ constructor: 'preparation' });
  assert.equal(summarizeAttempts([rec], inherited).unscopedAttempts, 1);
  const own = Object.fromEntries([['constructor', 'execution']]);
  assert.equal(summarizeAttempts([rec], own).scopes.execution.totals.attempts, 1);
  const approval = normalizedResult({ taskId: 'ordinary', approvalId: '__proto__' });
  const approvalScope = Object.fromEntries([['__proto__', 'correction']]);
  assert.equal(summarizeAttempts([approval], approvalScope).scopes.correction.totals.attempts, 1);
});
