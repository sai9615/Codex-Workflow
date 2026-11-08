import https from 'node:https';
import path from 'node:path';
import { constants } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isMain } from './validate.mjs';
import { checkAllowance, BudgetError } from './worker-budget.mjs';

export const endpoint = 'https://api.deepseek.com/responses';
// Conservative reservation floors from official pricing/model metadata checked2026-11-06.
// Higher verified snapshots are allowed; these are not estimates of actual request usage.
const billingReference = Object.freeze({
  'deepseek-flash': Object.freeze({ input: 1048576, output: 393216, miss: '0.3', hit: '0.006', outputRate: '1.2' }),
  'deepseek-v4-pro': Object.freeze({ input: 1048576, output: 393216, miss: '1.32', hit: '0.044', outputRate: '3.96' }),
});
export class WorkerError extends Error {
  constructor(code) { super(typeof code === 'string' && /^E_[A-Z_]{1,32}$/.test(code) ? code : 'E_LOCAL'); this.name = 'WorkerError'; this.code = this.message; }
}
const fail = code => { throw new WorkerError(code); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const integer = x => Number.isSafeInteger(x) && x >= 0;
const digest = x => createHash('sha256').update(x).digest('hex');
const hex = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const id = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x);
function keys(x, allowed, code) {
  if (!object(x) || Object.keys(x).some(k => !allowed.includes(k))) fail(code);
}
function date(x, code) {
  if (typeof x !== 'string' || !Number.isFinite(Date.parse(x))) fail(code);
  return Date.parse(x);
}
function money(x, code = 'E_PRICE') {
  if (typeof x !== 'string' || !/^\d{1,9}(?:\.\d{1,9})?$/.test(x)) fail(code);
  const [whole, fraction = ''] = x.split('.');
  return BigInt(whole) * 1000000000n + BigInt(fraction.padEnd(9, '0'));
}
const dollars = n => (n / 1000000000n).toString() + '.' + (n % 1000000000n).toString().padStart(9, '0');
const perMillion = n => (n + 999999n) / 1000000n;

const workerRoles = ['development', 'testing', 'review', 'debugging', 'correction'];
// A decision only: never launches a role, changes providers, or authorizes spending.
export function selectWorker({ complexity, risk, role, failedAttempts = 0,
  effort = 'high', effortJustification } = {}) {
  if (!['simple', 'normal', 'complex'].includes(complexity) ||
      !['low', 'normal', 'high'].includes(risk) || !workerRoles.includes(role) ||
      !integer(failedAttempts)) fail('E_SELECTION');
  if (failedAttempts >= 2) fail('E_ESCALATE');
  if (!['low', 'high', 'max'].includes(effort) ||
      (effortJustification !== undefined && (typeof effortJustification !== 'string' ||
        !effortJustification.trim() || Buffer.byteLength(effortJustification) > 2048)) ||
      (effort !== 'high' && (typeof effortJustification !== 'string' || !effortJustification.trim()))) fail('E_EFFORT');
  const pro = complexity === 'complex' || risk === 'high' || failedAttempts > 0;
  return { model: pro ? 'deepseek-v4-pro' : 'deepseek-flash', effort, role,
    rationale: failedAttempts ? 'Prior failure: reassess with Pro before another bounded attempt.' :
      risk === 'high' ? 'High risk: Pro and deeper independent Codex verification.' :
      complexity === 'complex' ? 'Complex work: Pro.' : 'Routine work: Flash.',
    codexVerification: risk === 'low' ? 'concise-evidence' : 'independent-depth',
    ...(effortJustification === undefined ? {} : { effortJustification }) };
}

export function prepareRequest(request) {
  keys(request, ['version', 'provider', 'taskId', 'candidateSha256', 'role', 'model', 'effort',
    'effortJustification', 'budgetJustification', 'instructions', 'input', 'maxOutputTokens', 'timeoutMs'], 'E_REQUEST');
  const effort = request.effort === undefined ? 'high' : request.effort;
  if (request.version !== 1 || request.provider !== 'deepseek' || !id(request.taskId) ||
      !hex(request.candidateSha256) || !workerRoles.includes(request.role) ||
      !['deepseek-flash', 'deepseek-v4-pro'].includes(request.model) ||
      !['none', 'low', 'high', 'max'].includes(effort) ||
      (request.effortJustification !== undefined && (typeof request.effortJustification !== 'string' ||
        !request.effortJustification.trim() || Buffer.byteLength(request.effortJustification) > 2048)) ||
      (effort === 'max' && request.effortJustification === undefined) ||
      (request.budgetJustification !== undefined && (typeof request.budgetJustification !== 'string' ||
        !request.budgetJustification.trim() || Buffer.byteLength(request.budgetJustification) > 2048)) ||
      typeof request.instructions !== 'string' || !request.instructions.trim() ||
      Buffer.byteLength(request.instructions) > 16384 ||
      !Array.isArray(request.input) || !request.input.length || request.input.length > 64) fail('E_REQUEST');
  // K6 dynamic allowances: production defaults stay 8192/60000; larger values require a
  // fingerprinted budgetJustification; policy ceilings are absolute. See worker-budget.mjs.
  try {
    checkAllowance({ maxOutputTokens: request.maxOutputTokens, timeoutMs: request.timeoutMs,
      budgetJustification: request.budgetJustification });
  } catch (error) {
    fail(error instanceof BudgetError ? error.code : 'E_REQUEST');
  }
  const input = Array.from(request.input, message => {
    keys(message, ['role', 'content'], 'E_REQUEST');
    if (!['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' ||
        !message.content.trim()) fail('E_REQUEST');
    return { role: message.role, content: message.content };
  });
  const scope = { version: 1, provider: 'deepseek', taskId: request.taskId,
    candidateSha256: request.candidateSha256, role: request.role, model: request.model,
    effort, instructions: request.instructions, input,
    maxOutputTokens: request.maxOutputTokens, timeoutMs: request.timeoutMs };
  if (request.effortJustification !== undefined) scope.effortJustification = request.effortJustification;
  if (request.budgetJustification !== undefined) scope.budgetJustification = request.budgetJustification;
  const body = { model: scope.model, instructions: scope.instructions, input,
    reasoning: { effort: scope.effort }, max_output_tokens: scope.maxOutputTokens,
    stream: false, tools: [], tool_choice: 'none', store: false };
  const bodyString = JSON.stringify(body);
  if (Buffer.byteLength(bodyString) > 65536) fail('E_REQUEST');
  return { scope, bodyString, requestSha256: digest(JSON.stringify(scope)) };
}

export function planRequest(request, approval, now = Date.now()) {
  const prepared = prepareRequest(request);
  keys(approval, ['version', 'id', 'approved', 'taskId', 'candidateSha256', 'requestSha256',
    'expiresAt', 'maxRequests', 'maxUsd', 'pricing'], 'E_APPROVAL');
  if (approval.version !== 1 || !id(approval.id) || typeof approval.approved !== 'boolean' ||
      approval.taskId !== prepared.scope.taskId || approval.candidateSha256 !== prepared.scope.candidateSha256 ||
      approval.requestSha256 !== prepared.requestSha256 || approval.maxRequests !== 1 ||
      approval.candidateSha256 === '0'.repeat(64)) fail('E_APPROVAL');
  const expires = date(approval.expiresAt, 'E_APPROVAL');
  if (!Number.isFinite(now) || expires <= now) fail('E_EXPIRED');
  const pricing = approval.pricing;
  keys(pricing, ['verified', 'model', 'currency', 'source', 'verifiedAt', 'expiresAt',
    'inputMissUsdPerMillion', 'inputHitUsdPerMillion', 'outputUsdPerMillion',
    'billingInputTokenCeiling', 'billingOutputTokenCeiling'], 'E_PRICE');
  if (pricing.verified !== true || pricing.model !== prepared.scope.model || pricing.currency !== 'USD' ||
      typeof pricing.source !== 'string') fail('E_PRICE');
  let url;
  try { url = new URL(pricing.source); } catch { fail('E_PRICE'); }
  if (url.protocol !== 'https:' || url.hostname !== 'api-docs.deepseek.com' ||
      url.username || url.password || url.port || url.search || url.hash) fail('E_PRICE');
  const priceStart = date(pricing.verifiedAt, 'E_PRICE'), priceEnd = date(pricing.expiresAt, 'E_PRICE');
  if (priceStart > now || priceEnd <= now || priceEnd <= priceStart) fail('E_PRICE');
  const inputCeiling = pricing.billingInputTokenCeiling, outputCeiling = pricing.billingOutputTokenCeiling;
  const reference = billingReference[prepared.scope.model];
  if (!integer(inputCeiling) || inputCeiling < reference.input || !integer(outputCeiling) ||
      outputCeiling < reference.output || outputCeiling < prepared.scope.maxOutputTokens) fail('E_PRICE');
  const rates = { miss: money(pricing.inputMissUsdPerMillion), hit: money(pricing.inputHitUsdPerMillion),
    output: money(pricing.outputUsdPerMillion) };
  if (rates.miss < money(reference.miss) || rates.hit < money(reference.hit) ||
      rates.output < money(reference.outputRate)) fail('E_PRICE');
  const reserved = perMillion(BigInt(inputCeiling) * (rates.miss > rates.hit ? rates.miss : rates.hit) +
    BigInt(outputCeiling) * rates.output);
  const cap = money(approval.maxUsd, 'E_BUDGET');
  if (cap <= 0n || reserved > cap) fail('E_BUDGET');
  return { ...prepared, approvalId: approval.id, approved: approval.approved, rates, reserved,
    inputCeiling, outputCeiling, deadline: Math.min(expires, priceEnd),
    timeoutMs: Math.min(prepared.scope.timeoutMs, expires - now, priceEnd - now),
    preview: { status: 'dry-run', provider: 'deepseek', model: prepared.scope.model,
      role: prepared.scope.role, requestSha256: prepared.requestSha256,
      candidateSha256: prepared.scope.candidateSha256, maxRequests: 1,
      reservedUsd: dollars(reserved), maxUsd: dollars(cap), credentialRead: false, networkRequests: 0 } };
}

export function normalizeUsage(usage) {
  if (!object(usage)) return null;
  const input = usage.input_tokens, output = usage.output_tokens, cached = usage.input_tokens_details?.cached_tokens,
    reasoning = usage.output_tokens_details?.reasoning_tokens, total = usage.total_tokens;
  if (![input, output, cached, reasoning, total].every(integer) || cached > input || reasoning > output ||
      !Number.isSafeInteger(input + output) || total !== input + output) return null;
  const tools = usage.server_tool_use;
  if (tools !== undefined && (!object(tools) || Object.keys(tools).some(k => !['tool_search', 'tool_fetch'].includes(k)) ||
      tools.tool_search !== 0 || tools.tool_fetch !== 0)) return null;
  return { inputTokens: input, outputTokens: output, cachedInputTokens: cached,
    reasoningOutputTokens: reasoning, totalTokens: total };
}
function estimate(usage, rates) {
  return perMillion(BigInt(usage.inputTokens - usage.cachedInputTokens) * rates.miss +
    BigInt(usage.cachedInputTokens) * rates.hit + BigInt(usage.outputTokens) * rates.output);
}

async function noSymlinks(target) {
  let current = path.resolve(target);
  for (;;) {
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) fail('E_PRIVATE_PATH');
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
async function privateDirectory(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory) || process.platform === 'win32') fail('E_JOURNAL');
  await noSymlinks(directory);
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077)) fail('E_JOURNAL');
}
async function createRecord(file, record) {
  let handle;
  try {
    handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    await handle.writeFile(JSON.stringify(record, null, 2) + '\n');
    await handle.sync();
  } catch (error) {
    if (error.code === 'EEXIST') fail('E_ATTEMPT_USED');
    fail('E_JOURNAL');
  } finally { await handle?.close(); }
}
export async function readCredential(file) {
  let handle;
  try {
    if (typeof file !== 'string' || !path.isAbsolute(file) || process.platform === 'win32') fail('E_CREDENTIAL');
    await noSymlinks(file);
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) ||
        stat.size < 1 || stat.size > 4096) fail('E_CREDENTIAL');
    const value = (await handle.readFile('utf8')).trim();
    if (!/^sk-[A-Za-z0-9_-]{16,512}$/.test(value)) fail('E_CREDENTIAL');
    return value;
  } catch { fail('E_CREDENTIAL'); }
  finally { await handle?.close(); }
}

// Exactly one application-level POST. No redirect, retry, tool dispatch or subprocess.
export function requestOnce({ bodyString, apiKey, timeoutMs, maxResponseBytes = 1048576 }) {
  return new Promise((resolve, reject) => {
    let request, timer, settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(new WorkerError(error)); else resolve(value);
    };
    timer = setTimeout(() => {
      finish('E_TIMEOUT'); request?.destroy();
    }, timeoutMs);
    try {
      request = https.request(endpoint, { method: 'POST', agent: false, rejectUnauthorized: true,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyString),
          Authorization: 'Bearer ' + apiKey } }, response => {
        if (response.statusCode !== 200) {
          response.destroy(); finish(null, { statusCode: response.statusCode, bodyString: '' }); return;
        }
        const chunks = []; let size = 0;
        response.on('data', chunk => {
          size += chunk.length;
          if (size > maxResponseBytes) {
            finish('E_RESPONSE_LIMIT'); response.destroy(); request.destroy();
          } else chunks.push(chunk);
        });
        response.on('error', () => finish('E_TRANSPORT'));
        response.on('end', () => finish(null, { statusCode: 200, bodyString: Buffer.concat(chunks).toString('utf8') }));
      });
      request.on('error', () => finish('E_TRANSPORT'));
      request.end(bodyString);
    } catch { finish('E_TRANSPORT'); }
  });
}

export async function runRequest({ request, approval, execute = false, journalDirectory, credentialFile,
  getCredential = () => readCredential(credentialFile), transport = requestOnce, now = Date.now, onProgress }) {
  const plan = planRequest(request, approval, now());
  if (!execute) return plan.preview;
  if (!plan.approved) fail('E_NOT_AUTHORIZED');
  const started = now();
  const progress = stage => {
    // Local status only: no prompts, output, reasoning, credentials or raw errors.
    if (typeof onProgress !== 'function') return;
    try {
      const observer = onProgress(Object.freeze({ stage,
        model: plan.scope.model, role: plan.scope.role, requestedEffort: plan.scope.effort,
        elapsedMs: Math.max(0, now() - started), reservedUsd: dollars(plan.reserved),
        timeoutMs: plan.timeoutMs, source: 'local-helper' }));
      observer?.catch?.(() => {});
    } catch { /* An observer cannot authorize, retry or interrupt dispatch. */ }
  };
  progress('preflight');
  await privateDirectory(journalDirectory);
  const prefix = path.join(journalDirectory, plan.approvalId);
  for (const suffix of ['.reserved.json', '.result.json']) {
    try { await lstat(prefix + suffix); fail('E_ATTEMPT_USED'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const record = { version: 1, approvalId: plan.approvalId, provider: 'deepseek',
    taskId: plan.scope.taskId, candidateSha256: plan.scope.candidateSha256,
    requestSha256: plan.requestSha256, model: plan.scope.model, effort: plan.scope.effort, role: plan.scope.role,
    status: 'reserved', reservedUsd: dollars(plan.reserved), currency: 'USD', maxRequests: 1,
    pricingSnapshotSha256: digest(JSON.stringify(approval.pricing)), budgetMaxUsd: approval.maxUsd,
    startedAt: new Date(now()).toISOString(), actualChargeUsd: null };
  if (plan.deadline <= now()) fail('E_EXPIRED');
  let apiKey;
  try { apiKey = await getCredential(); } catch { fail('E_CREDENTIAL'); }
  if (typeof apiKey !== 'string' || !/^sk-[A-Za-z0-9_-]{16,512}$/.test(apiKey)) fail('E_CREDENTIAL');
  if (JSON.stringify(plan.scope).includes(apiKey) || JSON.stringify(record).includes(apiKey)) fail('E_CREDENTIAL_IN_INPUT');
  if (plan.deadline <= now()) fail('E_EXPIRED');
  await createRecord(prefix + '.reserved.json', record);
  progress('reserved');
  let outputText, attempted = false, usage = null, estimatedUsd = null, providerRequestId = null, httpStatus = null, status = 'unknown', code;
  let providerReportedEffort = null, effortVerification = 'not-reported', heartbeat;
  try {
    const remaining = plan.deadline - now();
    if (remaining <= 0) fail('E_EXPIRED');
    attempted = true;
    progress('dispatch');
    if (typeof onProgress === 'function') heartbeat = setInterval(() => progress('waiting'), 5000);
    const response = await transport({ bodyString: plan.bodyString, apiKey, timeoutMs: Math.min(plan.timeoutMs, remaining) });
    clearInterval(heartbeat);
    progress('response-received');
    httpStatus = integer(response.statusCode) && response.statusCode >= 100 && response.statusCode <= 599 ? response.statusCode : null;
    if (httpStatus !== 200) fail('E_HTTP');
    if (typeof response.bodyString !== 'string' || Buffer.byteLength(response.bodyString) > 1048576) fail('E_RESPONSE_LIMIT');
    let data;
    try { data = JSON.parse(response.bodyString); } catch { fail('E_RESPONSE'); }
    if (!object(data) || data.model !== plan.scope.model || typeof data.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(data.id)) fail('E_RESPONSE');
    providerRequestId = data.id.split(apiKey).join('[REDACTED]');
    usage = normalizeUsage(data.usage);
    if (!usage) fail('E_USAGE');
    estimatedUsd = dollars(estimate(usage, plan.rates));
    if (data.reasoning?.effort !== undefined) {
      if (!['none', 'low', 'high', 'max'].includes(data.reasoning.effort)) {
        effortVerification = 'unsupported-provider-report'; fail('E_EFFORT');
      }
      providerReportedEffort = data.reasoning.effort;
      effortVerification = providerReportedEffort === plan.scope.effort ? 'provider-reported-match' : 'provider-reported-mismatch';
      if (providerReportedEffort !== plan.scope.effort) fail('E_EFFORT');
    }
    if (usage.inputTokens > plan.inputCeiling || usage.outputTokens > plan.outputCeiling ||
        usage.outputTokens > plan.scope.maxOutputTokens || estimate(usage, plan.rates) > plan.reserved) fail('E_LIMIT');
    if (!['completed', 'incomplete', 'failed'].includes(data.status) || !Array.isArray(data.output)) fail('E_RESPONSE');
    const texts = [];
    for (const item of data.output) {
      if (item?.type === 'reasoning') continue; // Never persist or return raw reasoning.
      if (item?.type !== 'message' || item.role !== 'assistant' || !Array.isArray(item.content)) fail('E_UNEXPECTED_OUTPUT');
      for (const content of item.content) {
        if (content?.type !== 'output_text' || typeof content.text !== 'string') fail('E_UNEXPECTED_OUTPUT');
        texts.push(content.text);
      }
    }
    outputText = texts.join('\n').split(apiKey).join('[REDACTED]');
    status = data.status;
    if (status === 'failed') { code = 'E_PROVIDER'; outputText = undefined; }
    else if (status === 'incomplete') code = 'E_INCOMPLETE';
  } catch (error) {
    code = error instanceof WorkerError ? error.code : attempted ? 'E_TRANSPORT' : 'E_CREDENTIAL';
  } finally { clearInterval(heartbeat); }
  const result = { ...record, status, code, requestAttempted: attempted, httpStatus, usage, estimatedUsd, providerRequestId,
    providerReportedEffort, effortVerification,
    endedAt: new Date(now()).toISOString(), reservationDisposition: 'held; reconcile with provider before any new authorization' };
  await createRecord(prefix + '.result.json', result); // Metadata only, never output/input/headers/key.
  progress(status === 'completed' ? 'completed' : 'stopped');
  return { ...result, outputText };
}

async function jsonFile(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) fail('E_INPUT_FILE');
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { fail('E_INPUT_FILE'); }
}
async function cli(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/deepseek-worker.mjs --request FILE [--approval FILE] [--progress] [--execute --credential-file FILE --journal-dir PRIVATE_DIR]\nDefault mode computes a request fingerprint only or a dry-run plan. --progress emits local status JSON to stderr, not provider streaming or raw reasoning. Live use requires separate explicit user authority.');
    return;
  }
  const values = {}; let execute = false, showProgress = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--execute') { if (execute) fail('E_ARGUMENTS'); execute = true; continue; }
    if (flag === '--progress') { if (showProgress) fail('E_ARGUMENTS'); showProgress = true; continue; }
    if (!['--request', '--approval', '--credential-file', '--journal-dir'].includes(flag) ||
        values[flag] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) fail('E_ARGUMENTS');
    values[flag] = args[++i];
  }
  if (!values['--request'] || (execute && (!values['--approval'] || !values['--credential-file'] || !values['--journal-dir'])) ||
      (!execute && (values['--credential-file'] || values['--journal-dir']))) fail('E_ARGUMENTS');
  const request = await jsonFile(values['--request']);
  if (!values['--approval']) {
    const p = prepareRequest(request);
    console.log(JSON.stringify({ status: 'needs-approval', requestSha256: p.requestSha256,
      taskId: p.scope.taskId, candidateSha256: p.scope.candidateSha256, model: p.scope.model,
      role: p.scope.role, effort: p.scope.effort, credentialRead: false, networkRequests: 0 }));
    return;
  }
  const approval = await jsonFile(values['--approval']);
  const result = await runRequest({ request, approval, execute, journalDirectory: values['--journal-dir'],
    credentialFile: values['--credential-file'],
    onProgress: showProgress ? event => process.stderr.write(JSON.stringify(event) + '\n') : undefined });
  console.log(JSON.stringify(result));
  if (execute && result.status !== 'completed') process.exitCode = 2;
}
if (await isMain(import.meta.url)) {
  cli(process.argv.slice(2)).catch(error => {
    console.error(JSON.stringify({ status: 'blocked', code: error instanceof WorkerError ? error.code : 'E_LOCAL' }));
    process.exitCode = 2;
  });
}
