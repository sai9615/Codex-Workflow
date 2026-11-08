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
const nanoToUsd = n => (n / NANOD).toString() + '.' + (n % NANOD).toString().padStart(9, '0');

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
  const totals = summary && summary.totals;
  if (!totals || !Number.isSafeInteger(totals.attempts)) fail('E_ENVELOPE');
  let heldNano = totals.reservedUsd === null ? null : moneyToNano(totals.reservedUsd);
  const knownNano = totals.estimatedUsd === null ? null : moneyToNano(totals.estimatedUsd);
  const unknowns = {
    usageUnknownAttempts: totals.usageUnknownAttempts,
    estimatedUsdUnknownAttempts: totals.estimatedUsdUnknownAttempts,
    unreconciledAttempts: summary.unreconciledAttempts,
  };
  const remainingRequests = env.maxRequests - totals.attempts;
  if (remainingRequests < 1) {
    return { ok: false, code: 'E_ENVELOPE_REQUESTS', reason: 'authorized request count exhausted; obtain fresh user authority before dispatch',
      usedRequests: totals.attempts, remainingRequests: 0, unknowns };
  }
  // Held reservations are worst-case liabilities; unknown actual charges make them the
  // conservative basis. If held is unknown (null), block rather than guess — except when
  // there are zero attempts, where held is exactly zero, not unknown (F-KIMI-02).
  if (heldNano === null && totals.attempts === 0) heldNano = 0n;
  if (heldNano === null) {
    return { ok: false, code: 'E_ENVELOPE_UNKNOWN', reason: 'held reservations unknown; reconcile journals before dispatch',
      usedRequests: totals.attempts, remainingRequests, unknowns };
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
