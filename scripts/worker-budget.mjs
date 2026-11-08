// Dynamic worker allowance policy (NW-020 K6). Decision aid only: it never dispatches,
// authorizes spending or edits approvals. Allowance values are bound into the request
// scope fingerprint by prepareRequest, so any change requires a matching fresh approval.

// Verified 2026-11-07 against https://api-docs.deepseek.com/quick_start/pricing/ model metadata.
export const MODEL_LIMITS = Object.freeze({
  'deepseek-flash': Object.freeze({ contextInput: 1048576, maxOutput: 393216 }),
  'deepseek-v4-pro': Object.freeze({ contextInput: 1048576, maxOutput: 393216 }),
});

// Production defaults are unchanged. Values above defaults require a per-request
// budgetJustification (fingerprinted); values above ceilings are rejected outright.
export const BUDGET_DEFAULTS = Object.freeze({ maxOutputTokens: 8192, timeoutMs: 60000 });
export const BUDGET_CEILINGS = Object.freeze({ maxOutputTokens: 65536, timeoutMs: 600000 });

// Every allowance keeps room for the actual answer below the reasoning budget, so a
// reasoning-heavy model cannot consume the entire allowance before producing an artifact.
export const FINAL_ANSWER_RESERVE = 4096;

const ROLES = ['development', 'testing', 'review', 'debugging', 'correction'];
const EFFORTS = ['none', 'low', 'high', 'max'];

export class BudgetError extends Error {
  constructor(code) {
    super(typeof code === 'string' && /^E_[A-Z_]{1,32}$/.test(code) ? code : 'E_BUDGET_POLICY');
    this.name = 'BudgetError'; this.code = this.message;
  }
}
const fail = code => { throw new BudgetError(code); };

const integer = x => Number.isSafeInteger(x) && x >= 0;

// Evidence tiers from measured 2026-11-07 runs:
// - 8192 exhausted by reasoning in 5 of 9 high-effort requests (zero artifact emitted).
// - 60s cut real responses (63.9s timeout-only; 145.49s completion at 32768 output budget).
// - low effort completed generation in 4-7K output tokens and 16-50s.
const TIERS = Object.freeze([
  Object.freeze({ maxOutputTokens: 8192, timeoutMs: 60000 }),    // tier 0: default
  Object.freeze({ maxOutputTokens: 24576, timeoutMs: 180000 }),  // tier 1: reasoning-heavy first attempt
  Object.freeze({ maxOutputTokens: 40960, timeoutMs: 300000 }),  // tier 2: after one truncation/timeout
  Object.freeze({ maxOutputTokens: 65536, timeoutMs: 600000 }),  // tier 3: ceiling, max effort only
]);

export function planAllowance({ role, model, effort = 'high', complexity, risk,
  priorAttempts = 0, priorTruncations = 0 } = {}) {
  if (!ROLES.includes(role) || !Object.keys(MODEL_LIMITS).includes(model) ||
      !EFFORTS.includes(effort) || !['simple', 'normal', 'complex'].includes(complexity) ||
      !['low', 'normal', 'high'].includes(risk) ||
      !integer(priorAttempts) || !integer(priorTruncations) ||
      priorTruncations > priorAttempts) fail('E_BUDGET_POLICY');
  if (priorAttempts >= 2) {
    return { escalation: 'user-approval-required', tier: null, maxOutputTokens: null, timeoutMs: null,
      rationale: 'Two unsuccessful attempts: stop, preserve evidence and obtain fresh user authority before any further spend. No silent retry or fallback.' };
  }
  const reasoningHeavy = effort === 'high' || effort === 'max';
  let tier = !reasoningHeavy || (complexity === 'simple' && risk === 'low' && role !== 'review') ? 0 : 1;
  tier = Math.min(tier + priorTruncations, TIERS.length - 1);
  if (effort === 'max') tier = TIERS.length - 1;
  const picked = TIERS[tier];
  const limits = MODEL_LIMITS[model];
  if (picked.maxOutputTokens > limits.maxOutput) fail('E_BUDGET_POLICY');
  const rationale = [
    `tier ${tier} for ${role}/${model}/${effort}`,
    reasoningHeavy ? 'reasoning-heavy effort: allowance includes headroom above measured 8192 truncation point' : 'measured low/none-effort completions fit the default tier',
    priorTruncations ? `raised after ${priorTruncations} truncation(s); not a silent retry: requires fresh approval` : 'no prior truncation',
    `final-answer reserve ${FINAL_ANSWER_RESERVE} tokens within allowance`,
    `within verified model limit ${limits.maxOutput} and policy ceilings ${BUDGET_CEILINGS.maxOutputTokens}/${BUDGET_CEILINGS.timeoutMs}`,
  ].join('; ');
  return { tier, maxOutputTokens: picked.maxOutputTokens, timeoutMs: picked.timeoutMs,
    reserveFinalAnswer: FINAL_ANSWER_RESERVE, rationale, escalation: null };
}

// Guard applied by prepareRequest: above-default allowances must carry a justification.
export function checkAllowance({ maxOutputTokens, timeoutMs, budgetJustification }) {
  if (!integer(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > BUDGET_CEILINGS.maxOutputTokens ||
      !integer(timeoutMs) || timeoutMs < 1 || timeoutMs > BUDGET_CEILINGS.timeoutMs) fail('E_REQUEST');
  const above = maxOutputTokens > BUDGET_DEFAULTS.maxOutputTokens || timeoutMs > BUDGET_DEFAULTS.timeoutMs;
  if (above && (typeof budgetJustification !== 'string' || !budgetJustification.trim() ||
      Buffer.byteLength(budgetJustification) > 2048)) fail('E_BUDGET_POLICY');
  return { aboveDefaults: above };
}
