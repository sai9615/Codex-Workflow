import { readFile, lstat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

class WorkerResultError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorkerResultError';
    this.code = code;
  }
}

const MAX_FILE_BYTES = 1 << 20; // 1 MiB
const TASK_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HEX64_RE = /^[0-9a-fA-F]{64}$/;
const MONEY_RE = /^\d{1,9}(\.\d{1,9})?$/;
const ROLES = new Set(['development', 'testing', 'review', 'debugging', 'correction']);
const VERDICTS = new Set(['pass', 'fail', 'blocked']);
const SEVERITIES = new Set(['critical', 'major', 'minor', 'note']);

const TOP_KEYS = new Set([
  'version', 'taskId', 'role', 'verdict', 'artifacts', 'tests',
  'usage', 'findings', 'blockers',
]);
const ARTIFACT_KEYS = new Set(['path', 'sha256']);
const TEST_KEYS = new Set(['executed', 'passed', 'failed', 'evidence']);
const USAGE_KEYS = new Set(['inputTokens', 'outputTokens', 'estimatedUsd']);
const FINDING_KEYS = new Set(['id', 'severity', 'location', 'summary']);

function fail(message) {
  throw new WorkerResultError('E_RESULT', message);
}

function evidence(message) {
  throw new WorkerResultError('E_EVIDENCE', message);
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

function intNonNegative(v, label, max) {
  if (!Number.isSafeInteger(v) || v < 0) fail(`${label}: expected integer >= 0`);
  if (max !== undefined && v > max) fail(`${label}: exceeds max ${max}`);
  return v;
}

function stringList(v, label, max) {
  if (!Array.isArray(v)) fail(`${label}: expected array`);
  if (v.length > max) fail(`${label}: too many entries (max ${max})`);
  for (let i = 0; i < v.length; i += 1) nonEmptyString(v[i], `${label}[${i}]`);
  return v;
}

function artifactList(v) {
  if (!Array.isArray(v)) fail('artifacts: expected array');
  if (v.length > 256) fail('artifacts: too many entries (max 256)');
  for (let i = 0; i < v.length; i += 1) {
    const a = v[i];
    if (!isPlainObject(a)) fail(`artifacts[${i}]: expected object`);
    checkKeys(a, ARTIFACT_KEYS, `artifacts[${i}]`);
    nonEmptyString(a.path, `artifacts[${i}].path`);
    if (typeof a.sha256 !== 'string' || !HEX64_RE.test(a.sha256)) {
      fail(`artifacts[${i}].sha256: expected 64-hex digest`);
    }
  }
  return v;
}

function findingList(v) {
  if (!Array.isArray(v)) fail('findings: expected array');
  if (v.length > 256) fail('findings: too many entries (max 256)');
  for (let i = 0; i < v.length; i += 1) {
    const f = v[i];
    if (!isPlainObject(f)) fail(`findings[${i}]: expected object`);
    checkKeys(f, FINDING_KEYS, `findings[${i}]`);
    nonEmptyString(f.id, `findings[${i}].id`);
    if (typeof f.severity !== 'string' || !SEVERITIES.has(f.severity)) {
      fail(`findings[${i}].severity: expected critical|major|minor|note`);
    }
    nonEmptyString(f.location, `findings[${i}].location`);
    nonEmptyString(f.summary, `findings[${i}].summary`);
  }
  return v;
}

function validateUsage(v) {
  if (v === null) return v;
  if (!isPlainObject(v)) fail('usage: expected object or null');
  checkKeys(v, USAGE_KEYS, 'usage');
  intNonNegative(v.inputTokens, 'usage.inputTokens');
  intNonNegative(v.outputTokens, 'usage.outputTokens');
  if (typeof v.estimatedUsd !== 'string' || !MONEY_RE.test(v.estimatedUsd)) {
    fail('usage.estimatedUsd: expected money string');
  }
  return v;
}

function validateWorkerResult(result) {
  if (!isPlainObject(result)) fail('result: expected object');
  for (const k of TOP_KEYS) {
    if (!(k in result)) fail(`missing key ${k}`);
  }
  checkKeys(result, TOP_KEYS, 'result');

  if (result.version !== 1) fail('version: expected exactly 1');
  if (typeof result.taskId !== 'string' || !TASK_ID_RE.test(result.taskId)) {
    fail('taskId: expected /^[A-Za-z0-9_-]{1,64}$/');
  }
  if (typeof result.role !== 'string' || !ROLES.has(result.role)) {
    fail('role: expected development|testing|review|debugging|correction');
  }
  if (typeof result.verdict !== 'string' || !VERDICTS.has(result.verdict)) {
    fail('verdict: expected pass|fail|blocked');
  }

  artifactList(result.artifacts);

  if (!isPlainObject(result.tests)) fail('tests: expected object');
  checkKeys(result.tests, TEST_KEYS, 'tests');
  const executed = intNonNegative(result.tests.executed, 'tests.executed');
  const passed = intNonNegative(result.tests.passed, 'tests.passed');
  const failed = intNonNegative(result.tests.failed, 'tests.failed');
  nonEmptyString(result.tests.evidence, 'tests.evidence');
  if (passed + failed !== executed) {
    fail('tests: passed + failed must equal executed');
  }

  validateUsage(result.usage);
  findingList(result.findings);
  stringList(result.blockers, 'blockers', 256);

  const blockingFinding = result.findings.some((f) => f.severity === 'critical' || f.severity === 'major' || f.severity === 'minor');
  if (result.verdict === 'pass') {
    if (result.artifacts.length < 1 || executed < 1) {
      evidence('unsupported PASS: requires artifacts and executed tests');
    }
    if (failed !== 0 || result.blockers.length !== 0 || blockingFinding) {
      evidence('unsupported PASS: requires zero failed tests, no blockers, and no critical/major/minor findings');
    }
  }
  if (result.verdict === 'fail' && result.findings.length < 1) {
    evidence('unsupported FAIL: requires at least one finding');
  }
  if (result.verdict === 'blocked' && result.blockers.length < 1) {
    evidence('unsupported BLOCKED: requires at least one blocker');
  }

  return { ok: true };
}

async function readChecked(file, label) {
  let st;
  try {
    st = await lstat(file);
  } catch {
    throw new WorkerResultError('E_INPUT_FILE', `${label}: cannot stat ${file}`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new WorkerResultError('E_INPUT_FILE', `${label}: not a regular file: ${file}`);
  }
  if (st.size > MAX_FILE_BYTES) {
    throw new WorkerResultError('E_INPUT_FILE', `${label}: exceeds 1 MiB: ${file}`);
  }
  try {
    return await readFile(file);
  } catch {
    throw new WorkerResultError('E_INPUT_FILE', `${label}: cannot read ${file}`);
  }
}

function parseArgs(argv) {
  const out = { result: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (typeof v !== 'string' || v.startsWith('--')) {
        throw new WorkerResultError('E_USAGE', `${a}: missing file argument`);
      }
      i += 1;
      return v;
    };
    if (a === '--result') out.result = next();
    else throw new WorkerResultError('E_USAGE', `unknown argument: ${a}`);
  }
  if (!out.result) throw new WorkerResultError('E_USAGE', '--result FILE is required');
  return out;
}

async function main(argv) {
  const args = parseArgs(argv);
  const raw = await readChecked(args.result, 'result');
  let result;
  try {
    result = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new WorkerResultError('E_RESULT', 'result: invalid JSON');
  }
  validateWorkerResult(result);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    taskId: result.taskId,
    verdict: result.verdict,
  })}\n`);
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

export { validateWorkerResult, WorkerResultError };
