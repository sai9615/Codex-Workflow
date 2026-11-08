import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

class ContextError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContextError';
    this.code = code;
  }
}

const MAX_FILE_BYTES = 1 << 20; // 1 MiB
const TASK_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HEX40_RE = /^[0-9a-fA-F]{40}$/;
const HEX64_RE = /^[0-9a-fA-F]{64}$/;
const MONEY_RE = /^\d{1,9}(\.\d{1,9})?$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const RISK = new Set(['low', 'normal', 'high']);
const COMPLEXITY = new Set(['simple', 'normal', 'complex']);

const TOP_KEYS = new Set([
  'version', 'taskId', 'criteria', 'baseline', 'candidateSha256',
  'risk', 'complexity', 'authority', 'evidence', 'budget',
]);
const BASELINE_KEYS = new Set(['head', 'manifestSha256']);
const AUTHORITY_KEYS = new Set(['approvedBy', 'scope', 'maxUsd', 'expiresAt']);
const BUDGET_KEYS = new Set(['maxRequests', 'maxOutputTokens', 'timeoutMs']);

function fail(message) {
  throw new ContextError('E_CONTEXT', message);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function checkKeys(obj, allowed, label) {
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) fail(`${label}: unexpected key ${k}`);
  }
}

function nonEmptyString(v, label) {
  if (typeof v !== 'string' || v.trim().length === 0) {
    fail(`${label}: expected non-empty string`);
  }
  return v;
}

function stringList(v, label, max) {
  if (!Array.isArray(v) || v.length === 0) {
    fail(`${label}: expected non-empty array`);
  }
  if (v.length > max) fail(`${label}: too many entries (max ${max})`);
  for (let i = 0; i < v.length; i += 1) nonEmptyString(v[i], `${label}[${i}]`);
  return v;
}

function hexString(v, re, label) {
  if (typeof v !== 'string' || !re.test(v)) fail(`${label}: expected hex digest`);
  return v.toLowerCase();
}

function isoExpiry(v, nowMs, label) {
  if (typeof v !== 'string' || !ISO_RE.test(v)) fail(`${label}: expected ISO date string`);
  const t = Date.parse(v);
  if (Number.isNaN(t)) fail(`${label}: unparseable date`);
  if (t <= nowMs) throw new ContextError('E_EXPIRED', `${label}: authority expired`);
  return v;
}

function positiveInt(v, label, max) {
  if (!Number.isSafeInteger(v) || v < 1) fail(`${label}: expected positive integer`);
  if (max !== undefined && v > max) fail(`${label}: exceeds max ${max}`);
  return v;
}

function validateContext(ctx, now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) fail('now: expected finite timestamp');

  if (!isPlainObject(ctx)) fail('context: expected object');
  checkKeys(ctx, TOP_KEYS, 'context');

  if (ctx.version !== 1) fail('version: expected exactly 1');

  if (typeof ctx.taskId !== 'string' || !TASK_ID_RE.test(ctx.taskId)) {
    fail('taskId: expected /^[A-Za-z0-9_-]{1,64}$/');
  }

  stringList(ctx.criteria, 'criteria', 32);

  if (!isPlainObject(ctx.baseline)) fail('baseline: expected object');
  checkKeys(ctx.baseline, BASELINE_KEYS, 'baseline');
  hexString(ctx.baseline.head, HEX40_RE, 'baseline.head');
  hexString(ctx.baseline.manifestSha256, HEX64_RE, 'baseline.manifestSha256');

  const candidate = hexString(ctx.candidateSha256, HEX64_RE, 'candidateSha256');
  if (/^0+$/.test(candidate)) fail('candidateSha256: must not be all zeros');

  if (typeof ctx.risk !== 'string' || !RISK.has(ctx.risk)) {
    fail('risk: expected low|normal|high');
  }
  if (typeof ctx.complexity !== 'string' || !COMPLEXITY.has(ctx.complexity)) {
    fail('complexity: expected simple|normal|complex');
  }

  if (!isPlainObject(ctx.authority)) fail('authority: expected object');
  checkKeys(ctx.authority, AUTHORITY_KEYS, 'authority');
  nonEmptyString(ctx.authority.approvedBy, 'authority.approvedBy');
  nonEmptyString(ctx.authority.scope, 'authority.scope');
  if (typeof ctx.authority.maxUsd !== 'string' || !MONEY_RE.test(ctx.authority.maxUsd)) {
    fail('authority.maxUsd: expected money string');
  }
  isoExpiry(ctx.authority.expiresAt, nowMs, 'authority.expiresAt');

  stringList(ctx.evidence, 'evidence', 64);

  if (ctx.budget !== undefined) {
    if (!isPlainObject(ctx.budget)) fail('budget: expected object');
    checkKeys(ctx.budget, BUDGET_KEYS, 'budget');
    positiveInt(ctx.budget.maxRequests, 'budget.maxRequests', 100);
    positiveInt(ctx.budget.maxOutputTokens, 'budget.maxOutputTokens');
    positiveInt(ctx.budget.timeoutMs, 'budget.timeoutMs');
  }

  return { ok: true };
}

async function readChecked(file, label) {
  let st;
  try {
    st = await lstat(file);
  } catch {
    throw new ContextError('E_INPUT_FILE', `${label}: cannot stat ${file}`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new ContextError('E_INPUT_FILE', `${label}: not a regular file: ${file}`);
  }
  if (st.size > MAX_FILE_BYTES) {
    throw new ContextError('E_INPUT_FILE', `${label}: exceeds 1 MiB: ${file}`);
  }
  try {
    return await readFile(file);
  } catch {
    throw new ContextError('E_INPUT_FILE', `${label}: cannot read ${file}`);
  }
}

function parseArgs(argv) {
  const out = { context: null, manifest: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (typeof v !== 'string' || v.startsWith('--')) {
        throw new ContextError('E_USAGE', `${a}: missing file argument`);
      }
      i += 1;
      return v;
    };
    if (a === '--context') out.context = next();
    else if (a === '--manifest') out.manifest = next();
    else throw new ContextError('E_USAGE', `unknown argument: ${a}`);
  }
  if (!out.context) throw new ContextError('E_USAGE', '--context FILE is required');
  return out;
}

async function main(argv) {
  const args = parseArgs(argv);
  const raw = await readChecked(args.context, 'context');
  let ctx;
  try {
    ctx = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new ContextError('E_CONTEXT', 'context: invalid JSON');
  }
  validateContext(ctx);
  if (args.manifest) {
    const bytes = await readChecked(args.manifest, 'manifest');
    const sha = createHash('sha256').update(bytes).digest('hex');
    if (sha !== ctx.candidateSha256.toLowerCase()) {
      throw new ContextError('E_STALE', 'candidateSha256 does not match manifest bytes');
    }
  }
  process.stdout.write(`${JSON.stringify({ ok: true, taskId: ctx.taskId })}\n`);
}

const isMain = typeof process.argv[1] === 'string'
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main(process.argv.slice(2)).catch((err) => {
    const code = err && typeof err.code === 'string' && /^E_[A-Z_]+$/.test(err.code)
      ? err.code
      : 'E_INTERNAL';
    process.stderr.write(`${code}\n`);
    process.exitCode = 2;
  });
}

export { validateContext, ContextError };
