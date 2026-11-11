import { readFile, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

class JournalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'JournalError';
    this.code = code;
  }
}

const SCOPES = ['preparation', 'execution', 'correction', 'reporting'];
const NANOD = 1_000_000_000n;
const USD_RE = /^-?\d+(?:\.\d{1,9})?$/;

function usdToNano(value, code, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !USD_RE.test(value)) {
    throw new JournalError(code, `${label}: invalid USD decimal string`);
  }
  const neg = value.startsWith('-');
  const body = neg ? value.slice(1) : value;
  const [whole, frac = ''] = body.split('.');
  const fracPadded = (frac + '000000000').slice(0, 9);
  if (frac.length > 9) {
    throw new JournalError(code, `${label}: too many decimal places`);
  }
  const nano = BigInt(whole) * NANOD + BigInt(fracPadded);
  return neg ? -nano : nano;
}

function nanoToUsd(nano) {
  if (nano === null) return null;
  const neg = nano < 0n;
  const abs = neg ? -nano : nano;
  const whole = abs / NANOD;
  const frac = (abs % NANOD).toString().padStart(9, '0');
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

function compareKeys(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortObject(obj) {
  return Object.fromEntries(
    Object.keys(obj).sort(compareKeys).map(k => [k, obj[k]])
  );
}

function readUsage(usage, code) {
  if (usage === null || usage === undefined) return null;
  if (typeof usage !== 'object' || Array.isArray(usage)) {
    throw new JournalError(code, 'usage must be an object or null');
  }
  const fields = ['inputTokens', 'outputTokens', 'cachedInputTokens', 'reasoningOutputTokens', 'totalTokens'];
  const out = {};
  for (const f of fields) {
    const v = usage[f];
    if (v === null || v === undefined) { out[f] = null; continue; }
    if (!Number.isSafeInteger(v) || v < 0) {
      throw new JournalError(code, `usage.${f} must be a non-negative integer or null`);
    }
    out[f] = v;
  }
  return out;
}

function attemptKey(rec) {
  return JSON.stringify([
    rec.approvalId,
    rec.taskId,
    rec.provider,
    rec.model,
    rec.candidateSha256 ?? null,
    rec.requestSha256 ?? null,
  ]);
}

function normalizeRecord(raw, fileKind, file) {
  const code = 'E_JOURNAL_MALFORMED';
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new JournalError(code, `${file}: record must be an object`);
  }
  const need = ['approvalId', 'provider', 'taskId', 'model', 'status'];
  for (const f of need) {
    if (typeof raw[f] !== 'string' || raw[f].length === 0) {
      throw new JournalError(code, `${file}: missing required string field ${f}`);
    }
  }
  const status = raw.status;
  if (fileKind === 'reserved') {
    if (status !== 'reserved') {
      throw new JournalError('E_JOURNAL_STATUS_MISMATCH', `${file}: reserved file must have status "reserved"`);
    }
  } else {
    if (!['completed', 'incomplete', 'failed', 'unknown', 'reserved'].includes(status)) {
      throw new JournalError(code, `${file}: invalid result status "${status}"`);
    }
    if (status === 'reserved') {
      throw new JournalError(code, `${file}: result file must not carry reserved status`);
    }
  }
  let usage = null;
  if (fileKind === 'result') usage = readUsage(raw.usage, code);
  const reservedUsd = usdToNano(raw.reservedUsd ?? null, 'E_JOURNAL_MONEY', `${file} reservedUsd`);
  if (reservedUsd !== null && reservedUsd < 0n) {
    throw new JournalError('E_JOURNAL_MONEY', `${file} reservedUsd: must be non-negative`);
  }
  const estimatedUsd = fileKind === 'result'
    ? usdToNano(raw.estimatedUsd ?? null, 'E_JOURNAL_MONEY', `${file} estimatedUsd`)
    : null;
  if (estimatedUsd !== null && estimatedUsd < 0n) {
    throw new JournalError('E_JOURNAL_MONEY', `${file} estimatedUsd: must be non-negative`);
  }
  return {
    fileKind,
    file,
    approvalId: raw.approvalId,
    provider: raw.provider,
    taskId: raw.taskId,
    model: raw.model,
    candidateSha256: typeof raw.candidateSha256 === 'string' ? raw.candidateSha256 : null,
    requestSha256: typeof raw.requestSha256 === 'string' ? raw.requestSha256 : null,
    status,
    usage,
    estimatedUsd,
    reservedUsd,
    actualChargeUsd: raw.actualChargeUsd === undefined ? null : raw.actualChargeUsd,
  };
}

function emptyBucket() {
  return {
    attempts: 0,
    completed: 0,
    incomplete: 0,
    failed: 0,
    unknown: 0,
    unsettled: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningOutputTokens: 0,
    estimatedUsdNano: 0n,
    reservedUsdNano: 0n,
    estimatedUsdKnownAttempts: 0,
    reservedUsdKnownAttempts: 0,
    usageUnknownAttempts: 0,
  };
}

function addToBucket(b, att) {
  b.attempts += 1;
  if (att.fileKind === 'reserved') {
    b.unsettled += 1;
    b.usageUnknownAttempts += 1;
  } else {
    switch (att.status) {
      case 'completed': b.completed += 1; break;
      case 'incomplete': b.incomplete += 1; break;
      case 'failed': b.failed += 1; break;
      default: b.unknown += 1; break;
    }
    if (att.usage === null) {
      b.usageUnknownAttempts += 1;
    } else {
      if (att.usage.inputTokens === null || att.usage.outputTokens === null) {
        b.usageUnknownAttempts += 1; // partially unknown usage must not read as a known smaller number
      }
      if (att.usage.inputTokens !== null) b.inputTokens += att.usage.inputTokens;
      if (att.usage.outputTokens !== null) b.outputTokens += att.usage.outputTokens;
      if (att.usage.cachedInputTokens !== null) b.cachedInputTokens += att.usage.cachedInputTokens;
      if (att.usage.reasoningOutputTokens !== null) b.reasoningOutputTokens += att.usage.reasoningOutputTokens;
    }
    if (att.estimatedUsd !== null) { b.estimatedUsdNano += att.estimatedUsd; b.estimatedUsdKnownAttempts += 1; }
  }
  if (att.reservedUsd !== null) { b.reservedUsdNano += att.reservedUsd; b.reservedUsdKnownAttempts += 1; }
}

function finalizeBucket(b) {
  return sortObject({
    attempts: b.attempts,
    completed: b.completed,
    incomplete: b.incomplete,
    failed: b.failed,
    unknown: b.unknown,
    unsettled: b.unsettled,
    usageUnknownAttempts: b.usageUnknownAttempts,
    inputTokens: b.inputTokens,
    outputTokens: b.outputTokens,
    cachedInputTokens: b.cachedInputTokens,
    reasoningOutputTokens: b.reasoningOutputTokens,
    estimatedUsd: b.estimatedUsdKnownAttempts > 0 ? nanoToUsd(b.estimatedUsdNano) : null,
    reservedUsd: b.reservedUsdKnownAttempts > 0 ? nanoToUsd(b.reservedUsdNano) : null,
    estimatedUsdUnknownAttempts: b.attempts - (b.unsettled + b.estimatedUsdKnownAttempts),
    reservedUsdUnknownAttempts: b.attempts - b.reservedUsdKnownAttempts,
  });
}

function scopeValue(scopeMap, id) {
  if (scopeMap instanceof Map) return scopeMap.get(id);
  if (scopeMap && typeof scopeMap === 'object') {
    return Object.prototype.hasOwnProperty.call(scopeMap, id) ? scopeMap[id] : undefined;
  }
  return undefined;
}

function resolveScope(att, scopeMap) {
  if (!scopeMap) return 'unscoped';
  const byTask = scopeValue(scopeMap, att.taskId);
  const byApproval = scopeValue(scopeMap, att.approvalId);
  const pick = byTask ?? byApproval;
  if (pick === undefined || pick === null) return 'unscoped';
  if (!SCOPES.includes(pick)) {
    throw new JournalError('E_JOURNAL_SCOPE_INVALID', `scopeMap: invalid scope "${pick}" for ${att.taskId}/${att.approvalId}`);
  }
  return pick;
}

export function summarizeAttempts(records, scopeMap = null) {
  if (!Array.isArray(records)) {
    throw new JournalError('E_JOURNAL_INPUT', 'records must be an array');
  }
  const normalized = records.map((r) => {
    if (r && r.fileKind === 'reserved' || r && r.fileKind === 'result') return r;
    throw new JournalError('E_JOURNAL_INPUT', 'records must be normalized attempts');
  });
  const metadataByScope = new Map();
  for (const att of normalized) {
    const scope = JSON.stringify([att.approvalId, att.provider]);
    const tuple = JSON.stringify([att.taskId, att.model, att.candidateSha256 ?? null, att.requestSha256 ?? null]);
    const prevTuple = metadataByScope.get(scope);
    if (prevTuple !== undefined && prevTuple !== tuple) {
      throw new JournalError('E_JOURNAL_METADATA_MISMATCH',
        `approvalId/provider scope ${att.approvalId}/${att.provider} has conflicting attempt metadata`);
    }
    metadataByScope.set(scope, tuple);
  }
  const finals = new Map();
  for (const att of normalized) {
    const key = attemptKey(att);
    const prev = finals.get(key);
    if (!prev) { finals.set(key, att); continue; }
    if (prev.fileKind === att.fileKind) {
      throw new JournalError('E_JOURNAL_DUPLICATE', `duplicate ${att.fileKind} for attempt ${key}`);
    }
    const winner = att.fileKind === 'result' ? att : prev;
    const loser = winner === att ? prev : att;
    // Result supersedes reserved but must not shrink the reservation known at reserve time.
    if (loser.reservedUsd !== null && (winner.reservedUsd === null || winner.reservedUsd < loser.reservedUsd)) {
      winner.reservedUsd = loser.reservedUsd;
    }
    finals.set(key, winner);
  }
  const scoped = new Map();
  let unscopedAttempts = 0;
  let unreconciled = 0;
  const attemptsMeta = [];
  for (const att of finals.values()) {
    const scope = resolveScope(att, scopeMap);
    if (scope === 'unscoped') unscopedAttempts += 1;
    if (att.fileKind === 'result' && att.actualChargeUsd === null) unreconciled += 1;
    const bucketKey = JSON.stringify([scope, att.provider, att.model]);
    let entry = scoped.get(bucketKey);
    if (!entry) {
      entry = { scope, provider: att.provider, model: att.model, bucket: emptyBucket() };
      scoped.set(bucketKey, entry);
    }
    addToBucket(entry.bucket, att);
    attemptsMeta.push({ scope, status: att.fileKind === 'reserved' ? 'unsettled' : att.status });
  }
  const grouped = new Map();
  for (const e of scoped.values()) {
    let g = grouped.get(e.scope);
    if (!g) { g = []; grouped.set(e.scope, g); }
    g.push(e);
  }
  const scopesOutMap = new Map();
  for (const scope of [...grouped.keys()].sort(compareKeys)) {
    const list = grouped.get(scope).sort((a, b) => {
      const p = compareKeys(a.provider, b.provider);
      return p !== 0 ? p : compareKeys(a.model, b.model);
    });
    const providersOutMap = new Map();
    const totalBucket = emptyBucket();
    for (const e of list) {
      let models = providersOutMap.get(e.provider);
      if (!models) {
        models = new Map();
        providersOutMap.set(e.provider, models);
      }
      models.set(e.model, finalizeBucket(e.bucket));
      const tb = totalBucket;
      const b = e.bucket;
      for (const k of ['attempts', 'completed', 'incomplete', 'failed', 'unknown', 'unsettled', 'usageUnknownAttempts', 'inputTokens', 'outputTokens', 'cachedInputTokens', 'reasoningOutputTokens', 'estimatedUsdKnownAttempts', 'reservedUsdKnownAttempts']) tb[k] += b[k];
      tb.estimatedUsdNano += b.estimatedUsdNano;
      tb.reservedUsdNano += b.reservedUsdNano;
    }
    const providersOut = Object.fromEntries(
      [...providersOutMap.entries()]
        .sort(([p1], [p2]) => compareKeys(p1, p2))
        .map(([provider, models]) => [
          provider,
          Object.fromEntries([...models.entries()].sort(([m1], [m2]) => compareKeys(m1, m2))),
        ])
    );
    scopesOutMap.set(scope, { providers: providersOut, totals: finalizeBucket(totalBucket) });
  }
  const scopesOut = Object.fromEntries(
    [...scopesOutMap.entries()].sort(([s1], [s2]) => compareKeys(s1, s2))
  );
  const grand = emptyBucket();
  for (const e of scoped.values()) {
    const b = e.bucket;
    for (const k of ['attempts', 'completed', 'incomplete', 'failed', 'unknown', 'unsettled', 'usageUnknownAttempts', 'inputTokens', 'outputTokens', 'cachedInputTokens', 'reasoningOutputTokens', 'estimatedUsdKnownAttempts', 'reservedUsdKnownAttempts']) grand[k] += b[k];
    grand.estimatedUsdNano += b.estimatedUsdNano;
    grand.reservedUsdNano += b.reservedUsdNano;
  }
  return {
    version: 1,
    currency: 'USD',
    moneyConvention: 'nanodollar-9dp',
    estimatedUsdAreEstimates: true,
    attempts: finals.size,
    unscopedAttempts,
    unreconciledAttempts: unreconciled,
    scopes: sortObject(scopesOut),
    totals: finalizeBucket(grand),
  };
}

const FILE_RE = /^(.+)\.(reserved|result)\.json$/;

async function loadJournalDirectory(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (err) {
    throw new JournalError('E_JOURNAL_DIR', `cannot read journal directory: ${err.message}`);
  }
  const files = [];
  for (const ent of entries) {
    const m = FILE_RE.exec(ent.name);
    if (!m) continue;
    const full = join(directory, ent.name);
    let st;
    try { st = await lstat(full); }
    catch (err) { throw new JournalError('E_JOURNAL_IO', `cannot stat ${ent.name}: ${err.message}`); }
    if (st.isSymbolicLink()) {
      throw new JournalError('E_JOURNAL_SYMLINK', `refusing symlinked journal file: ${ent.name}`);
    }
    if (!st.isFile()) {
      throw new JournalError('E_JOURNAL_NOT_FILE', `journal entry is not a regular file: ${ent.name}`);
    }
    files.push({ name: ent.name, kind: m[2], full });
  }
  files.sort((a, b) => compareKeys(a.name, b.name));
  const records = [];
  for (const f of files) {
    let text;
    try { text = await readFile(f.full, 'utf8'); }
    catch (err) { throw new JournalError('E_JOURNAL_IO', `cannot read ${f.name}: ${err.message}`); }
    let raw;
    try { raw = JSON.parse(text); }
    catch { throw new JournalError('E_JOURNAL_MALFORMED', `${f.name}: invalid JSON`); }
    records.push(normalizeRecord(raw, f.kind, f.name));
  }
  return records;
}

export async function aggregateJournals({ directory, scopeMap = null } = {}) {
  if (typeof directory !== 'string' || directory.length === 0) {
    throw new JournalError('E_JOURNAL_DIR', 'directory is required');
  }
  let map = null;
  if (scopeMap !== null && scopeMap !== undefined) {
    if (typeof scopeMap !== 'object' || Array.isArray(scopeMap)) {
      throw new JournalError('E_JOURNAL_SCOPE_INVALID', 'scopeMap must be an object');
    }
    map = new Map();
    for (const [k, v] of Object.entries(scopeMap)) {
      if (!SCOPES.includes(v)) {
        throw new JournalError('E_JOURNAL_SCOPE_INVALID', `invalid scope "${v}" for ${k}`);
      }
      map.set(k, v);
    }
  }
  const records = await loadJournalDirectory(directory);
  return summarizeAttempts(records, map);
}

function parseArgs(argv) {
  const out = { directory: null, scopeMapFile: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--journal-dir') { out.directory = argv[++i]; }
    else if (a === '--scope-map') { out.scopeMapFile = argv[++i]; }
    else if (a === '--help' || a === '-h') { out.help = true; }
    else throw new JournalError('E_JOURNAL_ARGV', `unknown argument: ${a}`);
  }
  return out;
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (err) { process.stderr.write(`${err.code}: ${err.message}\n`); process.exitCode = 2; return; }
  if (args.help) { process.stdout.write('usage: journal-aggregate.mjs --journal-dir DIR [--scope-map FILE]\n'); return; }
  if (!args.directory) { process.stderr.write('E_JOURNAL_ARGV: --journal-dir required\n'); process.exitCode = 2; return; }
  let scopeMap = null;
  if (args.scopeMapFile) {
    try {
      const text = await readFile(args.scopeMapFile, 'utf8');
      scopeMap = JSON.parse(text);
    } catch (err) {
      process.stderr.write(`E_JOURNAL_SCOPE_IO: ${err.message}\n`);
      process.exitCode = 3;
      return;
    }
  }
  try {
    const summary = await aggregateJournals({ directory: args.directory, scopeMap });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } catch (err) {
    if (err instanceof JournalError) {
      process.stderr.write(`${err.code}: ${err.message}\n`);
      process.exitCode = 1;
    } else {
      process.stderr.write(`E_JOURNAL_INTERNAL: ${err.message}\n`);
      process.exitCode = 1;
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
