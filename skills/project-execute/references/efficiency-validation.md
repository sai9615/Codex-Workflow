# Efficiency validation protocol

Use this protocol when evaluating workflow efficiency. It is an evidence plan, not a new runtime or authority to run live generation.

## Cheap checks first

Validate package/install boundaries and links, then use decision exercises covering low-risk edits, normal tested behavior, small security-sensitive changes, correction/re-review, stale context, unavailable reuse/compaction/telemetry, and stricter project requirements. Have an independent evaluator inspect the actual policy and raw scenario requirements. Record its decisions and findings; wording checks or simulated outcomes do not prove live orchestration behavior.

## Equivalent native comparisons

Freeze the old/new skill revisions, fixture baselines, acceptance criteria and independent correctness oracle. Use disposable copies for a small documentation/configuration task, a normal contract-tested function change, a higher-risk task with a labelled seeded defect, and a related follow-up that exercises reuse. Reset each arm to identical starting bytes; do not give one arm the other's solution or reviewer conclusions. Hold model, effort, provider, tools, permissions and requirements constant. Counterbalance order and repeat only within approved resources; otherwise label a single pair exploratory. Do not change real projects to create benchmark work.

Before a live test, obtain its bounded scope/resources where required, verify exposed native capabilities and measurement coverage, and state stopping/checkpoint conditions. A schema or help command proves an interface, not successful reuse or lower usage. Missing support gets a reported gap; do not build a service or silently substitute CLI/API sessions. Keep each role's independence history and single-writer boundaries intact.

## Measurements and aggregation

For each arm and task/attempt record actor/session IDs, role, new spawn or follow-up, requested/observed settings, reused context and why suitable, relevant repeated reads/context reconstruction, wall-clock start/end, input/output/cached tokens, test results, independent review findings, seeded-defect detection and final correctness. Include coordinator, intermediary, specialist, failed/retried/correction and compaction work where observable. Distinguish elapsed wall time from unavailable active model time.

Identify each counter's source, scope and whether incremental or cumulative. Use nonoverlapping deltas or one final total per accounting scope; do not add both. Verify whether parent totals include children before combining. Cached input is a subset of input and reasoning output a subset of output; neither is an extra saving to add. Missing counters remain unknown, with coverage stated. Never estimate tokens from bytes, number of agents or conversation length.

Record subscription/quota observations separately with capture times and concurrent-use limitations, if authorized and available. Tokens/cache counters do not reveal exact subscription consumption. A lower spawn count alone is a structural observation, not efficiency proof.

## Decision and reporting

Compare correctness, required tests, reviewer defect detection and approval/recovery safeguards first. A missed required check, independence failure or incorrectly accepted candidate disqualifies an apparent saving. Then compare total measured work, time and context reuse. Report differences with sample size, failed attempts, telemetry coverage, cache/order effects and limitations. No numerical savings claim without comparable measurements; no generalization from one fixture to all projects. Retain the old policy/candidate and evidence for narrow recovery. Adoption and publication are separate decisions.

## New DeepSeek Flash versus Pro comparison

Reuse historical evidence as historical context; never rerun a completed old-flow experiment to manufacture a matched baseline. If the old task/model/roles/telemetry do not match, state that no valid Codex reduction percentage is available. API connectivity checks are not benchmark arms and must not be repeated as setup.

Freeze one new pure-function task, candidate snapshot, requirements, immutable correctness oracle and role prompts before either arm. Use identical fresh starting bytes for Flash and Pro, high effort, output/time caps, permissions and required tests. Model is the intended independent variable; this is a model comparison, unlike the same-model workflow comparison above. Counterbalance only within approved resources; one pair is exploratory. Never give an arm the other arm's solution/verdict.

Each arm is sequential developer → separate tester → separate reviewer → risk-based Codex verification. Developer emits bounded artifacts; the coordinator checks paths/content before applying. Tester contributes additional tests but cannot modify/weaken the oracle; main runs tests and captures exit/stdout/stderr on exact bytes. Reviewer gets the compact package and source/raw evidence in an independent context. For review-quality measurement, include a separately labelled seeded regression challenge with an unchanged correct reference, distinguishing experimental fixtures from actual defects. Score correct defect localization, false positives, boundary/regression tests, and whether a defective candidate was incorrectly approved.

Allow a bounded correction and delta-first rereview only within exact authority; preserve failed/truncated/timed-out attempts and reservations. Stop on malformed artifacts, missing usage, role contamination, resource exhaustion or failed correctness criteria. Reuse selected same-role context as explicit text replay only; no provider-side session claim. Source packages/prompts and corrections are material paid/data scope; no-agent instructions block live role calls.

Report per-role provider tokens (input/output/cache/reasoning subsets), model/requested and provider-reported effort or unknown, estimated cost at stated rates versus actual reconciled charges, elapsed time, attempts/corrections, role-context reuse, executed tests/coverage, defects/false positives and final correctness. Include Codex coordinator/final-verification counters when exposed; unknown totals stay unknown. Compare Flash/Pro cost and time only after correctness/quality gates. Subscription quota cannot be derived from provider prices or token estimates. Keep the existing task/evidence registry as authority, not another benchmark status system.

## Scoped journal accounting

`scripts/journal-aggregate.mjs` turns helper attempt journals into a scoped summary; it is read-only and performs no network or credential access. Run it from the repository root:

~~~sh
node scripts/journal-aggregate.mjs --journal-dir PRIVATE_DIR [--scope-map scope.json]
~~~

Accounting convention:

1. Scopes are `preparation`, `execution`, `correction` and `reporting`; a scope map assigns taskIds/approvalIds, unmapped attempts stay `unscoped` and are never guessed.
2. One final record per attempt: a result supersedes its reservation; reserved-only attempts are `unsettled` with usage unknown, never zero.
3. Buckets are scope × provider × model. Per-scope and grand totals are labeled arithmetic aggregates across providers for magnitude only; conclusions about one provider must use its own bucket, and cross-provider token substitution (treating one provider's tokens as another's) remains prohibited.
4. Cached input and reasoning output are reported as subsets only and are never folded into input/output totals.
5. Money uses 9-decimal nanodollar strings with integer arithmetic; `estimatedUsd` values are peak-rate estimates and `actualChargeUsd: null` stays `unreconciledAttempts`, not zero.
6. Coordinator counter snapshots (Codex/Kimi native tokens) are recorded separately per actor with capture timestamps; use one final total or nonoverlapping deltas per actor scope, never both, and never merge them into provider buckets.
