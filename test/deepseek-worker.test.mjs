import test, { before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, readFile, readdir, rm, chmod, realpath, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { selectWorker, prepareRequest, planRequest, normalizeUsage, runRequest, readCredential, requestOnce, WorkerError } from '../scripts/deepseek-worker.mjs';

// No test in this file can reach a real HTTPS endpoint, even if a guard regresses.
before(() => mock.method(https, 'request', () => { throw new Error('OFFLINE_NETWORK_FORBIDDEN'); }));
after(() => mock.restoreAll());
const NOW = Date.UTC(2026, 10, 6, 21);
const iso = x => new Date(x).toISOString();
const KEY = 'sk-synthetic-only-not-a-real-credential';
function request() {
  return { version: 1, provider: 'deepseek', taskId: 'offline-case', candidateSha256: 'a'.repeat(64),
    role: 'testing', model: 'deepseek-flash', effort: 'none', instructions: 'Generate a test plan only.',
    input: [{ role: 'user', content: 'Review the supplied pure function.' }], maxOutputTokens: 128, timeoutMs: 1000 };
}
function approval(r = request(), now = NOW) {
  return { version: 1, id: 'grant-1', approved: true, taskId: r.taskId, candidateSha256: r.candidateSha256,
    requestSha256: prepareRequest(r).requestSha256, expiresAt: iso(now + 50000), maxRequests: 1, maxUsd: '10',
    pricing: { verified: true, model: r.model, currency: 'USD', source: 'https://api-docs.deepseek.com/',
      verifiedAt: iso(now - 1000), expiresAt: iso(now + 60000), inputMissUsdPerMillion: '2',
      inputHitUsdPerMillion: '0.5', outputUsdPerMillion: '3', billingInputTokenCeiling: 1048576,
      billingOutputTokenCeiling: 393216 } }; // Arbitrary synthetic rates/bounds, not provider prices.
}
function response(overrides = {}) {
  return { id: 'synthetic-response-1', model: 'deepseek-flash', status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Test plan.' }] }],
    usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 2 }, output_tokens: 5,
      output_tokens_details: { reasoning_tokens: 1 }, total_tokens: 15 }, ...overrides };
}
async function fixture(t) {
  const directory = await mkdtemp(path.join(await realpath(os.tmpdir()), 'deepseek-offline-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const r = request(), a = approval(r);
  let calls = 0, keyReads = 0;
  const run = options => runRequest({ request: r, approval: a, execute: true, journalDirectory: directory,
    now: () => NOW, getCredential: async () => { keyReads++; return KEY; },
    transport: async () => { calls++; return { statusCode: 200, bodyString: JSON.stringify(response()) }; }, ...options });
  return { directory, r, a, run, calls: () => calls, keyReads: () => keyReads };
}
const code = expected => error => error instanceof WorkerError && error.code === expected;

test('default dry run does not read a credential, dispatch, or write a journal', async t => {
  const f = await fixture(t), result = await f.run({ execute: false });
  assert.equal(result.status, 'dry-run'); assert.equal(result.reservedUsd, '3.276800000');
  assert.equal(f.calls(), 0); assert.equal(f.keyReads(), 0); assert.deepEqual(await readdir(f.directory), []);
});

test('unapproved, stale, mismatched and underfunded grants fail before key or dispatch', async t => {
  const f = await fixture(t);
  const cases = [
    [{ ...f.a, approved: false }, 'E_NOT_AUTHORIZED'],
    [{ ...f.a, expiresAt: iso(NOW) }, 'E_EXPIRED'],
    [{ ...f.a, requestSha256: 'f'.repeat(64) }, 'E_APPROVAL'],
    [{ ...f.a, taskId: 'different' }, 'E_APPROVAL'],
    [{ ...f.a, candidateSha256: 'b'.repeat(64) }, 'E_APPROVAL'],
    [{ ...f.a, maxRequests: 2 }, 'E_APPROVAL'],
    [{ ...f.a, maxUsd: '3.276799999' }, 'E_BUDGET'],
  ];
  for (const [a, expected] of cases) await assert.rejects(f.run({ approval: a }), code(expected));
  assert.equal(f.keyReads(), 0); assert.equal(f.calls(), 0); assert.deepEqual(await readdir(f.directory), []);
});

test('prices, currency, billing bounds and expiry must be explicitly verified', () => {
  const r = request(), a = approval(r);
  for (const change of [{ verified: false }, { currency: 'EUR' }, { model: 'other' },
    { inputMissUsdPerMillion: null }, { inputHitUsdPerMillion: '-1' }, { outputUsdPerMillion: 3 },
    { expiresAt: iso(NOW) }, { verifiedAt: iso(NOW + 1) }, { billingInputTokenCeiling: 0 },
    { billingOutputTokenCeiling: 127 }, { billingInputTokenCeiling: 1000 },
    { billingOutputTokenCeiling: 131072 }, { inputMissUsdPerMillion: '0.1' },
    { inputHitUsdPerMillion: '0.001' }, { outputUsdPerMillion: '1' }, { source: 'https://attacker.invalid/prices' },
    { source: 'https://user:secret@api-docs.deepseek.com/' }]) {
    assert.throws(() => planRequest(r, { ...a, pricing: { ...a.pricing, ...change } }, NOW), code('E_PRICE'));
  }
});

test('budget reservation rounds up, uses the higher input rate and never adds reasoning twice', () => {
  const r = request(), a = approval(r);
  assert.equal(planRequest(r, { ...a, maxUsd: '3.2768' }, NOW).preview.reservedUsd, '3.276800000');
  assert.equal(planRequest(r, { ...a, pricing: { ...a.pricing, inputHitUsdPerMillion: '5' } }, NOW).preview.reservedUsd, '6.422528000');
  const u = normalizeUsage(response().usage);
  assert.deepEqual(u, { inputTokens: 10, outputTokens: 5, cachedInputTokens: 2, reasoningOutputTokens: 1, totalTokens: 15 });
});

test('one completed request retains a metadata-only reservation and estimated cost', async t => {
  const f = await fixture(t), result = await f.run();
  assert.equal(f.calls(), 1); assert.equal(result.status, 'completed'); assert.equal(result.estimatedUsd, '0.000032000');
  assert.equal(result.actualChargeUsd, null); assert.equal(result.outputText, 'Test plan.');
  const reserved = await readFile(path.join(f.directory, 'grant-1.reserved.json'), 'utf8');
  const final = await readFile(path.join(f.directory, 'grant-1.result.json'), 'utf8');
  assert.equal(JSON.parse(reserved).reservedUsd, '3.276800000');
  for (const text of [reserved, final]) {
    assert.ok(!text.includes(KEY)); assert.ok(!text.includes('Generate a test plan')); assert.ok(!text.includes('Test plan.'));
    assert.ok(!text.includes('Authorization'));
  }
  assert.match(JSON.parse(final).reservationDisposition, /^held/);
});

test('duplicate and concurrent executions cannot dispatch a second request', async t => {
  const f = await fixture(t), results = await Promise.allSettled([f.run(), f.run()]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.filter(x => x.status === 'rejected' && x.reason.code === 'E_ATTEMPT_USED').length, 1);
  assert.equal(f.calls(), 1);
  await assert.rejects(f.run(), code('E_ATTEMPT_USED')); assert.equal(f.calls(), 1);
});

test('ambiguous timeout retains the reservation and blocks automatic replay', async t => {
  const f = await fixture(t); let attempts = 0;
  const result = await f.run({ transport: async () => { attempts++; throw new WorkerError('E_TIMEOUT'); } });
  assert.equal(result.status, 'unknown'); assert.equal(result.code, 'E_TIMEOUT'); assert.equal(result.actualChargeUsd, null);
  assert.equal(result.usage, null); assert.equal(result.reservedUsd, '3.276800000');
  await assert.rejects(f.run(), code('E_ATTEMPT_USED')); assert.equal(attempts, 1); assert.equal(f.calls(), 0);
});

test('HTTP errors and raw transport errors do not leak secrets or trigger retry', async t => {
  for (const kind of ['http', 'throw']) {
    const f = await fixture(t); let calls = 0;
    const result = await f.run({ transport: async () => {
      calls++; if (kind === 'throw') throw new Error(KEY);
      return { statusCode: 429, bodyString: KEY };
    } });
    assert.equal(calls, 1); assert.equal(result.status, 'unknown'); assert.equal(result.code, kind === 'http' ? 'E_HTTP' : 'E_TRANSPORT');
    assert.ok(!JSON.stringify(result).includes(KEY));
  }
});

test('provider text and request ID echoes are redacted; raw reasoning is omitted', async t => {
  const f = await fixture(t);
  const result = await f.run({ transport: async () => ({ statusCode: 200, bodyString: JSON.stringify(response({
    id: KEY, output: [{ type: 'reasoning', content: [{ text: KEY }] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: KEY }] }] })) }) });
  assert.equal(result.status, 'completed'); assert.equal(result.outputText, '[REDACTED]');
  assert.equal(result.providerRequestId, '[REDACTED]'); assert.ok(!JSON.stringify(result).includes(KEY));
});

test('known credential in payload or metadata is blocked before journal/dispatch', async t => {
  for (const field of ['instructions', 'taskId']) {
    const f = await fixture(t), r = { ...f.r, [field]: KEY };
    const a = approval(r);
    await assert.rejects(f.run({ request: r, approval: a }), code('E_CREDENTIAL_IN_INPUT'));
    assert.equal(f.calls(), 0); assert.deepEqual(await readdir(f.directory), []);
  }
});

test('malformed JSON, wrong model and unexpected tool output are not successful', async t => {
  const cases = [
    ['{', 'E_RESPONSE'],
    [JSON.stringify(response({ model: 'other' })), 'E_RESPONSE'],
    [JSON.stringify(response({ output: [{ type: 'function_call', name: 'execute_shell' }] })), 'E_UNEXPECTED_OUTPUT'],
    [JSON.stringify(response({ output: [{ type: 'message', role: 'user', content: [] }] })), 'E_UNEXPECTED_OUTPUT'],
  ];
  for (const [bodyString, expected] of cases) {
    const f = await fixture(t), result = await f.run({ transport: async () => ({ statusCode: 200, bodyString }) });
    assert.equal(result.status, 'unknown'); assert.equal(result.code, expected); assert.equal(result.outputText, undefined);
  }
});

test('missing/invalid usage and unexpected server tools remain unknown, never zero', async t => {
  for (const usage of [null, {}, { ...response().usage, input_tokens_details: {} },
    { ...response().usage, output_tokens_details: {} }, { ...response().usage, total_tokens: 16 },
    { ...response().usage, input_tokens_details: { cached_tokens: 11 } },
    { ...response().usage, output_tokens_details: { reasoning_tokens: 6 } },
    { ...response().usage, server_tool_use: { tool_search: 1, tool_fetch: 0 } }]) {
    const f = await fixture(t), result = await f.run({ transport: async () => ({ statusCode: 200, bodyString: JSON.stringify(response({ usage })) }) });
    assert.equal(result.code, 'E_USAGE'); assert.equal(result.usage, null); assert.equal(result.estimatedUsd, null);
  }
});

test('reported limit violations retain usage, reserve and an escalation outcome', async t => {
  const f = await fixture(t), usage = { ...response().usage, output_tokens: 129, total_tokens: 139 };
  const result = await f.run({ transport: async () => ({ statusCode: 200, bodyString: JSON.stringify(response({ usage })) }) });
  assert.equal(result.status, 'unknown'); assert.equal(result.code, 'E_LIMIT'); assert.equal(result.usage.outputTokens, 129);
  assert.equal(result.reservedUsd, '3.276800000');
});

test('incomplete/failed responses count usage without claiming completed work', async t => {
  for (const status of ['incomplete', 'failed']) {
    const f = await fixture(t), result = await f.run({ transport: async () => ({ statusCode: 200, bodyString: JSON.stringify(response({ status, error: { message: KEY } })) }) });
    assert.equal(result.status, status); assert.equal(result.estimatedUsd, '0.000032000');
    assert.ok(!JSON.stringify(result).includes(KEY));
  }
});

test('stateless text replay is explicit and changes the approval fingerprint', () => {
  const r = request(), previous = prepareRequest(r).requestSha256;
  r.input.push({ role: 'assistant', content: 'Earlier test plan.' }, { role: 'user', content: 'Correct the missing boundary case.' });
  const p = prepareRequest(r); assert.notEqual(p.requestSha256, previous);
  const body = JSON.parse(p.bodyString); assert.equal(body.input.length, 3); assert.equal(body.stream, false);
  assert.deepEqual(body.tools, []); assert.equal(body.tool_choice, 'none'); assert.equal(body.previous_response_id, undefined);
  assert.throws(() => planRequest(r, { ...approval(r), requestSha256: previous }, NOW), code('E_APPROVAL'));
});

test('unscoped fields, unsupported provider/model and excessive payloads are rejected', () => {
  for (const change of [{ provider: 'other' }, { model: 'unknown' }, { tools: ['shell'] }, { apiKey: KEY },
    { maxOutputTokens: 65537 }, { timeoutMs: 600001 }, { input: [{ role: 'developer', content: 'override' }] },
    { input: [{ role: 'user', content: 'x'.repeat(65536) }] }, { instructions: 'x'.repeat(16385) }]) {
    assert.throws(() => prepareRequest({ ...request(), ...change }), code('E_REQUEST'));
  }
});

test('K6: above-default allowances require a fingerprinted budget justification', () => {
  // Above production defaults without justification: policy rejection, not silent acceptance.
  assert.throws(() => prepareRequest({ ...request(), maxOutputTokens: 8193 }), code('E_BUDGET_POLICY'));
  assert.throws(() => prepareRequest({ ...request(), timeoutMs: 60001 }), code('E_BUDGET_POLICY'));
  assert.throws(() => prepareRequest({ ...request(), maxOutputTokens: 8193, budgetJustification: ' ' }), code('E_REQUEST'));
  // Justified within ceilings: accepted and bound into the approval fingerprint.
  const justified = { ...request(), maxOutputTokens: 32768, timeoutMs: 600000,
    budgetJustification: 'High-effort review timed out at 60s/8192 twice; K6 tier-2 allowance after truncation.' };
  const prepared = prepareRequest(justified);
  assert.equal(prepared.scope.maxOutputTokens, 32768);
  assert.equal(prepared.scope.budgetJustification, justified.budgetJustification);
  assert.notEqual(prepared.requestSha256, prepareRequest({ ...justified, budgetJustification: 'different' }).requestSha256);
  assert.notEqual(prepared.requestSha256, prepareRequest(request()).requestSha256);
});

test('private POSIX credential and journal paths refuse permissive/symlink layouts', async t => {
  if (process.platform === 'win32') return t.skip('Live helper intentionally requires verified POSIX file privacy.');
  const f = await fixture(t), file = path.join(f.directory, 'credential');
  await writeFile(file, KEY + '\n', { mode: 0o600 }); assert.equal(await readCredential(file), KEY);
  await chmod(file, 0o644); await assert.rejects(readCredential(file), code('E_CREDENTIAL'));
  await chmod(file, 0o600); const alias = path.join(f.directory, 'alias'); await symlink(file, alias);
  await assert.rejects(readCredential(alias), code('E_CREDENTIAL'));
  await chmod(f.directory, 0o755); await assert.rejects(f.run(), code('E_JOURNAL')); assert.equal(f.keyReads(), 0);
  await chmod(f.directory, 0o700);
});

test('requestOnce makes exactly one POST and refuses redirect/oversized/timeout paths', async t => {
  const seen = [];
  for (const scenario of ['success', 'redirect', 'oversized', 'timeout']) {
    const patch = t.mock.method(https, 'request', (url, options, callback) => {
      seen.push({ url, options }); const req = new EventEmitter(); req.destroy = () => {};
      req.end = body => {
        assert.equal(body, '{}');
        if (scenario === 'timeout') return;
        queueMicrotask(() => {
          const res = new EventEmitter(); res.statusCode = scenario === 'redirect' ? 302 : 200; res.destroy = () => {};
          callback(res); res.emit('data', Buffer.from(scenario === 'oversized' ? '123456' : '{}')); res.emit('end');
        });
      };
      return req;
    });
    const args = { bodyString: '{}', apiKey: KEY, timeoutMs: 10, maxResponseBytes: 4 };
    if (scenario === 'oversized' || scenario === 'timeout') await assert.rejects(requestOnce(args), code(scenario === 'timeout' ? 'E_TIMEOUT' : 'E_RESPONSE_LIMIT'));
    else assert.equal((await requestOnce(args)).statusCode, scenario === 'redirect' ? 302 : 200);
    patch.mock.restore();
  }
  assert.equal(seen.length, 4);
  for (const x of seen) { assert.equal(x.url, 'https://api.deepseek.com/responses'); assert.equal(x.options.method, 'POST'); assert.equal(x.options.agent, false); assert.equal(x.options.rejectUnauthorized, true); }
});

test('CLI fingerprint preview is offline and rejects execute without required arguments', async t => {
  const f = await fixture(t), file = path.join(f.directory, 'request.json'), blocker = path.join(f.directory, 'block-network.mjs');
  await writeFile(file, JSON.stringify(f.r)); await writeFile(blocker, "import https from 'node:https';https.request=()=>{throw new Error('OFFLINE_NETWORK_FORBIDDEN')};\n");
  const script = fileURLToPath(new URL('../scripts/deepseek-worker.mjs', import.meta.url));
  let r = spawnSync(process.execPath, ['--import', blocker, script, '--progress', '--request', file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); const preview = JSON.parse(r.stdout); assert.equal(preview.status, 'needs-approval'); assert.equal(preview.networkRequests, 0);
  assert.equal(r.stderr, '');
  r = spawnSync(process.execPath, ['--import', blocker, script, '--execute', '--request', file], { encoding: 'utf8' });
  assert.equal(r.status, 2); assert.equal(JSON.parse(r.stderr).code, 'E_ARGUMENTS');
});


test('the alternate documented model uses its own conservative pricing floor', async t => {
  const f = await fixture(t), r = { ...f.r, model: 'deepseek-v4-pro' }, a = approval(r);
  assert.throws(() => planRequest(r, a, NOW), code('E_PRICE'));
  a.pricing.outputUsdPerMillion = '4';
  const result = await f.run({ request: r, approval: a, transport: async () => ({ statusCode: 200, bodyString: JSON.stringify(response({ model: r.model })) }) });
  assert.equal(result.status, 'completed'); assert.equal(result.estimatedUsd, '0.000037000');
});

test('expired-during-preflight or partial reservation markers never read credentials or dispatch', async t => {
  const f = await fixture(t); let ticks = 0;
  await assert.rejects(f.run({ now: () => ticks++ ? NOW + 50001 : NOW }), code('E_EXPIRED'));
  assert.equal(f.keyReads(), 0); assert.equal(f.calls(), 0);
  await writeFile(path.join(f.directory, 'grant-1.reserved.json'), '{', { mode: 0o600 });
  await assert.rejects(f.run(), code('E_ATTEMPT_USED')); assert.equal(f.keyReads(), 0); assert.equal(f.calls(), 0);
});

test('hybrid routing uses task complexity, risk and failures without dispatching', () => {
  for (const role of ['development', 'testing', 'review', 'debugging', 'correction']) {
    const routine = selectWorker({ complexity: 'simple', risk: 'low', role });
    assert.equal(routine.model, 'deepseek-flash'); assert.equal(routine.effort, 'high');
    assert.equal(routine.codexVerification, 'concise-evidence');
    for (const change of [{ complexity: 'complex' }, { risk: 'high' }, { failedAttempts: 1 }]) {
      assert.equal(selectWorker({ complexity: 'simple', risk: 'low', role, ...change }).model, 'deepseek-v4-pro');
    }
    assert.equal(selectWorker({ complexity: 'simple', risk: 'high', role }).codexVerification, 'independent-depth');
  }
  assert.throws(() => selectWorker({ complexity: 'simple', risk: 'low', role: 'review', failedAttempts: 2 }), code('E_ESCALATE'));
  assert.throws(() => selectWorker({ complexity: 'simple', risk: 'unknown', role: 'review' }), code('E_SELECTION'));
  assert.throws(() => selectWorker({ complexity: 'simple', risk: 'low', role: 'coordinator' }), code('E_SELECTION'));
  assert.throws(() => selectWorker({ complexity: 'simple', risk: 'low', role: 'testing', effortJustification: 123 }), code('E_EFFORT'));
});

test('high is the normalized request default; xhigh is never silently mapped', () => {
  const r = request(); delete r.effort;
  const implicit = prepareRequest(r), explicit = prepareRequest({ ...r, effort: 'high' });
  assert.equal(implicit.scope.effort, 'high'); assert.equal(implicit.requestSha256, explicit.requestSha256);
  assert.equal(JSON.parse(implicit.bodyString).reasoning.effort, 'high');
  assert.throws(() => prepareRequest({ ...r, effort: 'xhigh' }), code('E_REQUEST'));
  assert.throws(() => selectWorker({ complexity: 'complex', risk: 'high', role: 'review', effort: 'xhigh' }), code('E_EFFORT'));
  assert.equal(prepareRequest({ ...r, role: 'review' }).scope.role, 'review');
});

test('max effort requires a scoped justification that participates in the approval fingerprint', () => {
  const r = { ...request(), effort: 'max' };
  for (const effortJustification of [undefined, '', ' ', 123]) {
    assert.throws(() => prepareRequest({ ...r, effortJustification }), code('E_REQUEST'));
  }
  const justified = { ...r, effortJustification: 'High failed a scoped dependency-contract check; bounded escalation.' };
  assert.equal(prepareRequest(justified).scope.effort, 'max');
  assert.notEqual(prepareRequest(justified).requestSha256, prepareRequest({ ...justified, effortJustification: 'Different scope' }).requestSha256);
  assert.throws(() => selectWorker({ complexity: 'complex', risk: 'high', role: 'review', effort: 'max' }), code('E_EFFORT'));
});

test('effort evidence distinguishes requested, provider-reported match, mismatch and absent echo', async t => {
  for (const reported of [undefined, 'none', 'high', 'xhigh']) {
    const f = await fixture(t);
    const result = await f.run({ transport: async () => ({ statusCode: 200,
      bodyString: JSON.stringify(response(reported === undefined ? {} : { reasoning: { effort: reported } })) }) });
    assert.equal(result.effort, 'none');
    if (reported === undefined) {
      assert.equal(result.providerReportedEffort, null); assert.equal(result.effortVerification, 'not-reported');
    } else if (reported === 'none') {
      assert.equal(result.status, 'completed'); assert.equal(result.effortVerification, 'provider-reported-match');
    } else {
      assert.equal(result.status, 'unknown'); assert.equal(result.code, 'E_EFFORT');
      assert.equal(result.outputText, undefined); assert.equal(result.usage.totalTokens, 15);
      assert.equal(result.effortVerification, reported === 'xhigh' ? 'unsupported-provider-report' : 'provider-reported-mismatch');
    }
  }
});

test('local progress is ordered and sanitized, and dry runs emit no live progress', async t => {
  const f = await fixture(t), events = [];
  await f.run({ execute: false, onProgress: e => events.push(e) }); assert.deepEqual(events, []);
  const result = await f.run({ onProgress: e => events.push(e) });
  assert.equal(result.status, 'completed');
  assert.deepEqual(events.map(e => e.stage), ['preflight', 'reserved', 'dispatch', 'response-received', 'completed']);
  for (const event of events) {
    assert.equal(event.source, 'local-helper'); assert.equal(event.requestedEffort, 'none');
    assert.equal(event.elapsedMs, 0); assert.ok(Object.isFrozen(event));
    const text = JSON.stringify(event);
    for (const forbidden of [KEY, 'Generate a test plan', 'Test plan.', 'Authorization', 'taskId']) assert.ok(!text.includes(forbidden));
  }
});

test('progress cannot leak a credential in metadata before the credential guard', async t => {
  const f = await fixture(t), r = { ...f.r, taskId: KEY }, events = [];
  await assert.rejects(f.run({ request: r, approval: approval(r), onProgress: e => events.push(e) }), code('E_CREDENTIAL_IN_INPUT'));
  assert.equal(f.calls(), 0); assert.ok(!JSON.stringify(events).includes(KEY));
});

test('broken observers cannot trigger retries or prevent a result journal', async t => {
  for (const observer of [() => { throw new Error(KEY); }, async () => { throw new Error(KEY); }]) {
    const f = await fixture(t), result = await f.run({ onProgress: observer });
    assert.equal(result.status, 'completed'); assert.equal(f.calls(), 1);
    assert.equal(JSON.parse(await readFile(path.join(f.directory, 'grant-1.result.json'), 'utf8')).status, 'completed');
  }
});

test('timeouts produce a stopped progress event without implying provider progress or refund', async t => {
  const f = await fixture(t), events = [];
  const result = await f.run({ onProgress: e => events.push(e), transport: async () => { throw new WorkerError('E_TIMEOUT'); } });
  assert.deepEqual(events.map(e => e.stage), ['preflight', 'reserved', 'dispatch', 'stopped']);
  assert.equal(result.status, 'unknown'); assert.equal(result.usage, null); assert.match(result.reservationDisposition, /^held/);
});

test('waiting heartbeat is local and stops when the provider request finishes', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const f = await fixture(t), events = [];
  let begin, release;
  const began = new Promise(resolve => { begin = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const pending = f.run({ onProgress: e => events.push(e), transport: async () => {
    begin(); await gate; return { statusCode: 200, bodyString: JSON.stringify(response()) };
  } });
  await began; t.mock.timers.tick(5000);
  assert.equal(events.at(-1).stage, 'waiting'); assert.equal(events.at(-1).source, 'local-helper');
  release(); assert.equal((await pending).status, 'completed');
  const count = events.length; t.mock.timers.tick(10000); assert.equal(events.length, count);
});

test('a known credential in effort justification is blocked before reservation or dispatch', async t => {
  const f = await fixture(t), r = { ...f.r, effort: 'max', effortJustification: KEY };
  await assert.rejects(f.run({ request: r, approval: approval(r) }), code('E_CREDENTIAL_IN_INPUT'));
  assert.equal(f.calls(), 0); assert.deepEqual(await readdir(f.directory), []);
});

test('both model contracts accept an independent review role with default high effort', async t => {
  for (const model of ['deepseek-flash', 'deepseek-v4-pro']) {
    const f = await fixture(t), r = { ...f.r, model, role: 'review' }; delete r.effort;
    const a = approval(r); a.pricing.outputUsdPerMillion = '4';
    const result = await f.run({ request: r, approval: a, transport: async ({ bodyString }) => {
      const body = JSON.parse(bodyString); assert.equal(body.reasoning.effort, 'high');
      assert.deepEqual(body.tools, []); assert.equal(body.tool_choice, 'none');
      return { statusCode: 200, bodyString: JSON.stringify(response({ model, reasoning: { effort: 'high' } })) };
    } });
    assert.equal(result.status, 'completed'); assert.equal(result.role, 'review');
    assert.equal(result.providerReportedEffort, 'high'); assert.equal(result.effortVerification, 'provider-reported-match');
  }
});
