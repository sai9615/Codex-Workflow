// Pre-dispatch envelope guard (NW-020 K6). Answers one question before any request:
// does the authorized envelope still cover this dispatch? A blocked result means the
// coordinator must return to the user for fresh authority — never dispatch anyway.
import { readFile, lstat } from 'node:fs/promises';
import { aggregateJournals } from './journal-aggregate.mjs';
import { isMain } from './validate.mjs';

export class EnvelopeError extends Error {
  constructor(code) {
    super(typeof code === 'string' && /^E_[A-Z_]{1,32}$/.test(code) ? code : 'E_ENVELOPE');
    this.name = 'EnvelopeError'; this.code = this.message;
  }
}
const fail = code => { throw new EnvelopeError(code); };

const NANOD = 1000000000n;
const moneyToNano = x => {
  if (typeof x !== 'string' || !/^\d{1,9}(?:\.\d{1,9})?$/.test(x)) fail('E_ENVELOPE');
  const [w, f = ''] = x.split('.');
  return BigInt(w) * NANOD + BigInt((f + '000000000').slice(0, 9));
};
const nanoToUsd = n => {
  if (n === null) return null;
  if (n === 0n) return '0.000000000';
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = (abs / NANOD).toString();
  const frac = (abs % NANOD).toString().padStart(9, '0');
  return `${neg ? '-' : ''}${whole}.${frac}`;
};

// envelope: { maxRequests: int >= 1, totalCapUsd: money string } — closed shape.
export function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
      Object.keys(envelope).some(k => !['maxRequests', 'totalCapUsd'].includes(k))) fail('E_ENVELOPE');
  if (!Number.isSafeInteger(envelope.maxRequests) || envelope.maxRequests < 1) fail('E_ENVELOPE');
  return { maxRequests: envelope.maxRequests, capNano: moneyToNano(envelope.totalCapUsd) };
}

// summary: output of aggregateJournals. plannedReservedUsd: reservation of the next dispatch.
export function checkEnvelope({ envelope, summary, plannedReservedUsd }) {
  const env = validateEnvelope(envelope);
  const plannedNano = moneyToNano(plannedReservedUsd);
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) fail('E_ENVELOPE');
  const totals = summary.totals;
  if (!totals || !Number.isSafeInteger(totals.attempts) || totals.attempts < 0) fail('E_ENVELOPE');
  if (!Number.isSafeInteger(summary.attempts) || summary.attempts !== totals.attempts) fail('E_ENVELOPE');

  const usageUnknownAttempts = totals.usageUnknownAttempts;
  const estimatedUsdUnknownAttempts = totals.estimatedUsdUnknownAttempts;
  const reservedUsdUnknownAttempts = totals.reservedUsdUnknownAttempts;
  const unreconciledAttempts = summary.unreconciledAttempts;
  for (const v of [usageUnknownAttempts, estimatedUsdUnknownAttempts, reservedUsdUnknownAttempts, unreconciledAttempts]) {
    if (!Number.isSafeInteger(v) || v < 0 || v > totals.attempts) fail('E_ENVELOPE');
  }

  const unknowns = {
    usageUnknownAttempts,
    estimatedUsdUnknownAttempts,
    reservedUsdUnknownAttempts,
    unreconciledAttempts,
  };

  let heldNano = totals.reservedUsd === null ? null : moneyToNano(totals.reservedUsd);
  const knownNano = totals.estimatedUsd === null ? null : moneyToNano(totals.estimatedUsd);

  if (totals.attempts === 0) {
    if (usageUnknownAttempts !== 0 || estimatedUsdUnknownAttempts !== 0 ||
        reservedUsdUnknownAttempts !== 0 || unreconciledAttempts !== 0 ||
        (totals.reservedUsd !== null && moneyToNano(totals.reservedUsd) !== 0n) ||
        (knownNano !== null && knownNano !== 0n)) {
      fail('E_ENVELOPE');
    }
    heldNano = 0n;
  } else if (reservedUsdUnknownAttempts > 0 || heldNano === null) {
    return { ok: false, code: 'E_ENVELOPE_UNKNOWN', reason: 'held reservations partially or fully unknown; reconcile journals before dispatch',
      usedRequests: totals.attempts, remainingRequests: env.maxRequests - totals.attempts, unknowns };
  }

  const remainingRequests = env.maxRequests - totals.attempts;
  if (remainingRequests < 1) {
    return { ok: false, code: 'E_ENVELOPE_REQUESTS', reason: 'authorized request count exhausted; obtain fresh user authority before dispatch',
      usedRequests: totals.attempts, remainingRequests: 0, unknowns };
  }

  const remainingNano = env.capNano - heldNano;
  if (plannedNano > remainingNano) {
    return { ok: false, code: 'E_ENVELOPE_BUDGET', reason: 'planned reservation exceeds remaining authorized budget; obtain fresh user authority before dispatch',
      usedRequests: totals.attempts, remainingRequests, heldUsd: nanoToUsd(heldNano),
      remainingUsd: nanoToUsd(remainingNano), plannedUsd: nanoToUsd(plannedNano),
      knownEstimatedUsd: knownNano === null ? null : nanoToUsd(knownNano), unknowns };
  }
  return { ok: true, usedRequests: totals.attempts, remainingRequests,
    heldUsd: nanoToUsd(heldNano), remainingUsd: nanoToUsd(remainingNano),
    plannedUsd: nanoToUsd(plannedNano),
    knownEstimatedUsd: knownNano === null ? null : nanoToUsd(knownNano), unknowns };
}

async function jsonFile(file) {
  const stat = await lstat(file).catch(() => fail('E_INPUT_FILE'));
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) fail('E_INPUT_FILE');
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { fail('E_INPUT_FILE'); }
}

async function main(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!['--journal-dir', '--envelope', '--planned-reservation'].includes(flag) ||
        values[flag] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) fail('E_ARGUMENTS');
    values[flag] = argv[++i];
  }
  if (!values['--journal-dir'] || !values['--envelope'] || !values['--planned-reservation']) fail('E_ARGUMENTS');
  const summary = await aggregateJournals({ directory: values['--journal-dir'] });
  const envelope = await jsonFile(values['--envelope']);
  const result = checkEnvelope({ envelope, summary, plannedReservedUsd: values['--planned-reservation'] });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.ok) process.exitCode = 2;
}

if (await isMain(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(JSON.stringify({ ok: false, code: error instanceof EnvelopeError ? error.code : 'E_LOCAL' }) + '\n');
    process.exitCode = 2;
  });
}
