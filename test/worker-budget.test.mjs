import test from 'node:test';
import assert from 'node:assert/strict';
import { planAllowance, checkAllowance, BUDGET_DEFAULTS, BUDGET_CEILINGS, MODEL_LIMITS, ANSWER_HEADROOM_TOKENS } from '../scripts/worker-budget.mjs';

const code = expected => e => e.code === expected;
const base = { role: 'development', model: 'deepseek-flash', effort: 'high', complexity: 'normal', risk: 'normal' };

test('defaults stay the production floor for routine low-effort work', () => {
  const p = planAllowance({ ...base, effort: 'low', complexity: 'simple', risk: 'low' });
  assert.equal(p.tier, 0);
  assert.equal(p.maxOutputTokens, BUDGET_DEFAULTS.maxOutputTokens);
  assert.equal(p.timeoutMs, BUDGET_DEFAULTS.timeoutMs);
  assert.equal(p.escalation, null);
  assert.equal(p.answerHeadroomTokens, ANSWER_HEADROOM_TOKENS);
  assert.match(p.rationale, /advisory answer headroom/);
});

test('high-effort roles get measured headroom above the 8192 truncation point', () => {
  const p = planAllowance(base);
  assert.equal(p.tier, 1);
  assert.ok(p.maxOutputTokens > 8192);
  assert.ok(p.timeoutMs > 60000);
  assert.ok(p.maxOutputTokens >= ANSWER_HEADROOM_TOKENS * 2);
  assert.match(p.rationale, /truncation/);
});

test('truncations raise the tier and are never a silent retry', () => {
  const p = planAllowance({ ...base, priorAttempts: 1, priorTruncations: 1 });
  assert.equal(p.tier, 2);
  assert.match(p.rationale, /requires fresh approval/);
});

test('two failed attempts stop spend and require user authority', () => {
  const p = planAllowance({ ...base, priorAttempts: 2, priorTruncations: 2 });
  assert.equal(p.escalation, 'user-approval-required');
  assert.equal(p.maxOutputTokens, null);
});

test('max effort takes the ceiling tier; ceilings and model limits are absolute', () => {
  const p = planAllowance({ ...base, effort: 'max' });
  assert.equal(p.maxOutputTokens, BUDGET_CEILINGS.maxOutputTokens);
  assert.equal(p.timeoutMs, BUDGET_CEILINGS.timeoutMs);
  assert.ok(p.maxOutputTokens <= MODEL_LIMITS['deepseek-flash'].maxOutput);
});

test('invalid inputs and inconsistent counters are rejected', () => {
  for (const change of [{ role: 'boss' }, { model: 'unknown' }, { effort: 'xhigh' },
    { complexity: 'weird' }, { risk: 'extreme' }, { priorAttempts: -1 },
    { priorAttempts: 0, priorTruncations: 1 }]) {
    assert.throws(() => planAllowance({ ...base, ...change }), code('E_BUDGET_POLICY'));
  }
});

test('checkAllowance enforces defaults-without-justification and absolute ceilings', () => {
  assert.deepEqual(checkAllowance({ maxOutputTokens: 8192, timeoutMs: 60000 }), { aboveDefaults: false });
  assert.deepEqual(checkAllowance({ maxOutputTokens: 32768, timeoutMs: 600000, budgetJustification: 'measured truncation' }), { aboveDefaults: true });
  assert.throws(() => checkAllowance({ maxOutputTokens: 8193, timeoutMs: 60000 }), code('E_BUDGET_POLICY'));
  assert.throws(() => checkAllowance({ maxOutputTokens: 8192, timeoutMs: 60001 }), code('E_BUDGET_POLICY'));
  assert.throws(() => checkAllowance({ maxOutputTokens: 65537, timeoutMs: 60000, budgetJustification: 'x' }), code('E_REQUEST'));
  assert.throws(() => checkAllowance({ maxOutputTokens: 8192, timeoutMs: 600001, budgetJustification: 'x' }), code('E_REQUEST'));
  assert.throws(() => checkAllowance({ maxOutputTokens: 0, timeoutMs: 60000, budgetJustification: 'x' }), code('E_REQUEST'));
});
