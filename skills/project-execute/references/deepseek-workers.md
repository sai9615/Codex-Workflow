# Optional DeepSeek workers

Codex remains the coordinator with its existing provider and final-verification responsibility. For explicitly authorized provider-enabled work, prefer DeepSeek development, mandatory testing and independent initial review. The bounded helper and native-provider example are separate paths; a successful one-request API smoke does not validate native Codex workers, a complete correction loop or billing reconciliation. Installing this source does not configure credentials or alter Codex provider defaults.

## DeepSeek-first role sequence

Use the existing project-plan/project-execute flow, not another coordinator or service:

1. Codex plans the approved task, assesses complexity/risk, chooses model/effort and exact paid/data scope, and prepares requirements, candidate identity and essential context.
2. A DeepSeek developer supplies changes in a dedicated development context. Main inspects proposed artifacts before applying them; helper output never executes automatically.
3. A distinct DeepSeek tester receives requirements/candidate and generates or assesses acceptance/regression tests. Main runs actual approved local commands and captures raw results; model assertions are not test execution. Include boundary and dependency cases; coverage percentages require a measured report.
4. A distinct DeepSeek reviewer starts with the compact package, independently inspects supplied source/diff/raw tests, and reports stable finding IDs, locations, impact and evidence. Never give a developer context the independent-review role or replay developer deliberation/another review verdict into an initial independent review. Missing essential source/evidence requires an expanded bounded package, not PASS. A separate request/context is role separation, not independently enforced filesystem isolation or model diversity.
5. Codex verifies concise criterion/test/finding/identity evidence for low-risk work. For high-risk work, independently inspect relevant source/trust boundaries and rerun discriminating tests as needed. Preserve stronger project requirements for a separate independent Codex reviewer. Main's own review of its implementation is not independent.
6. Return findings to the same suitable developer context, rerun affected tests through the tester context and actual local runner, then give the same suitable reviewer prior findings, correction diff and fresh evidence. Use [delta-first rereview](reviewer-package.md#correction-and-rereview-loop) and broaden for dependencies, risk or drift. Default ceiling: two unsuccessful attempts for a work item, fewer when resources/risk require; stop for reassessment before another. No automatic retry/tool execution/provider fallback. Each changed request needs its own scope/approval/reservation.

A solo/no-agent instruction blocks worker launches, including external model role calls. Main may prepare source and run offline tests alone, but must leave required independent/live criteria pending. Credential availability does not waive spending authority, result acceptance, installation or publication.

## Model selection and reasoning evidence

| Situation | Preferred model | Requested effort |
| --- | --- | --- |
| Routine development, testing, simple review | deepseek-flash (V4.1 Flash) | high |
| Complex development/reasoning/review or high-risk task | deepseek-v4-pro (V4 Pro) | high |
| Prior failure | Reassess with Pro within remaining authority | high initially |
| High insufficient for a specific obstacle | Appropriate model with explicit benefit/resource justification | max only when justified |

Official metadata currently lists low/high/max for both models. xhigh is unsupported: reject it and report the gap, never alias it. Reverify capabilities before adding a future level. Lower effort is a justified exception. The helper normalizes omitted effort to high; explicit none/low remain available for approved probes/exceptions. max requires effortJustification in the fingerprinted scope. selectWorker is an offline routing decision/rationale aid; main can make a different quality/cost/risk choice only with its reason recorded and exact request approval. It never dispatches or authorizes spending.

Record requested effort separately from providerReportedEffort. A response echo supports only provider-reported agreement; absent echo stays not-reported. A conflicting/unsupported echo stops the outcome while retaining usage/reservation. Token counts, output quality, model assertions and display flags do not prove internal computation.

## Research and coordinator visibility

Use existing supported coordinator search/documentation tools when current dependencies/APIs or uncertain claims need research. Prefer primary sources, retrieve supporting pages, include links/dates in the package, and reuse fresh research. Avoid searches for stable supplied facts. Flash does not support provider web_search; Pro does, but max_tool_calls is ignored and server operations cost extra. This helper therefore keeps provider tools disabled and rejects injected tools or nonzero server-tool usage. Coordinator-assisted research supplies the needed context. Server-side search requires enforceable limits and separately authorized accounting before enabling it.

For a separately authorized helper request, --progress emits sanitized local JSON stages to stderr: preflight, reserved, dispatch, waiting every five seconds, response-received, completed/stopped. Fields contain selected model/role/requested effort, elapsed time, reservation and timeout; no prompt, key, output, raw errors or reasoning. A waiting heartbeat is a local timer, not evidence of provider activity. Observer errors cannot cause retries or authorize actions. Store progress once with existing attempt evidence; inspect new output through existing foreground tool sessions. Scope/result journals remain durable evidence. Preflight failures can precede a result journal, so preserve the separate CLI error. No new monitoring daemon is introduced.

Richer future visibility can use official Responses streaming events for response creation, generation, output/tool activity and terminal usage. This helper is non-streaming: do not label local events as provider events or claim live token/cost telemetry before final usage. An SSE extension requires framing/sequence/terminal validation and unchanged one-request/timeout/secret controls. Action summaries, artifact changes, test results, findings and blockers are actionable coordinator evidence; raw reasoning does not replace these checks.

show_raw_agent_reasoning=true surfaces reasoning only when a compatible native Codex model emits it. It does not start a helper stream or grant access to another session. The inactive native example opts into that display flag; the helper still omits raw reasoning from its output/journal. Future native UI output must remain private and outside ordinary evidence exports.

## Supported mechanisms and current evidence

Official sources checked 2026-11-06:

- [DeepSeek Responses guide](https://api-docs.deepseek.com/guides/responses_api/) and [API reference](https://api-docs.deepseek.com/api/create-response/) document Responses requests, output limits and usage. Conversations are stateless; several parameters are ignored. Do not infer compatibility from an OpenAI-compatible label alone.
- [DeepSeek Codex setup](https://api-docs.deepseek.com/quick_start/agent_integrations/codex/) provides native provider/catalog guidance. The previously observed CLI0.141.0 is below its declared catalog minimum0.144.0; that route remains unverified.
- [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) do not support switching an inherited provider through a custom role file. Current native collaboration model controls do not establish mixed-provider children.
- [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-advanced) uses separate user-level profile files. [Gateway compatibility](https://learn.chatgpt.com/docs/enterprise/gateway-compatibility) identifies streaming, tool and continuation checks required before claiming native integration.
- [Current prices](https://api-docs.deepseek.com/quick_start/pricing/) and [model metadata](https://api-docs.deepseek.com/api/list-models/) must be reverified before a live reservation. Peak/off-peak rates differ. The canonical trailing-slash pricing page was accessible during the later verification; earlier access failures remain historical evidence.

Documentation establishes a proposed interface. Mocked tests establish local helper behavior. Neither establishes real credentials, provider execution, billing or native session reuse.

## Path A: one-request helper under the existing coordinator

The dependency-free helper is `scripts/deepseek-worker.mjs` relative to the matching reviewed repository or built distribution root. It is not copied into installed skills. Its request and approval examples are `config/deepseek-request.example.json` and `config/deepseek-approval.example.json` in that same source/distribution. They are inactive placeholders, with no credential or live authority.

The helper only sends one text request and returns untrusted text. It does not apply patches, run generated tests/commands, execute tool calls, launch agents, select another provider or implement a correction loop. The existing coordinator continues those decisions through project-execute and its current testing/review/approval policy.

From the source/distribution root, offline preview is:

~~~sh
node scripts/deepseek-worker.mjs --request config/deepseek-request.example.json
~~~

This prints a scope fingerprint without reading credentials, creating attempt records or contacting a provider. Adding an approval file without --execute still performs only a dry run. No environment-key discovery occurs.

### Exact execution gates

Main must first obtain explicit user authority for the precise request, candidate identity, role, provider/model/effort, permitted data, timeout and USD cap. A receipt records that decision; a JSON field or command flag cannot prove human authorization. Never create an approved receipt on the user's behalf before that decision. A general request to prepare integration or an offer of a key does not authorize a live call.

A real request requires:

1. A non-placeholder candidate SHA256, bounded text-only input, one of the documented models and a supported effort (high when omitted). max additionally requires a scoped effortJustification. Do not silently map Codex Medium or xhigh to a provider effort. API tools are empty and tool_choice is none. Baseline allowances are8192 output tokens and60000ms; justified, fingerprint-bound requests may use up to65536 tokens and600000ms under the dynamic allowance policy. These are local policy ceilings, not provider capability claims.
2. A matching nonexpired approval ID, task, candidate and normalized request SHA256; maxRequests must equal1. Each correction or changed input needs its own exact approval and coordinator accounting against the remaining task budget.
3. A verified nonexpired USD price snapshot and full model billing input/output ceilings from current authoritative metadata. Reserve worst-case input at the higher cache-hit/miss rate plus the full declared output ceiling, rounded upward to nanodollars. The helper rejects snapshots below its dated documented model ceilings and peak-price floors; reverify current metadata/prices and use higher values if they changed. Do not estimate tokens from bytes to approve spending. Reject a cap below the reservation. This conservatively reserves model ceilings even when the requested output limit is much lower.
4. An explicitly supplied absolute credential-file path: regular, owner-owned, owner-only and without symlink ancestors, on the supported POSIX host. No key in source, prompts, arguments, receipts or logs. Real configuration must be performed securely outside source control; never paste a key in chat. The helper reads the file only after scope/price/authority checks and rejects a known key appearing in input or metadata.
5. An explicitly supplied existing owner-private journal directory. It creates a private exclusive approval-ID reservation before dispatch, refuses existing reservation/result markers and makes one application-level HTTPS POST to api.deepseek.com/responses. No redirect or retry. Duplicate/concurrent use of that approval cannot make a second request. Protect this directory from other writers; deleting or changing grants/journals defeats caller-side controls and is not recovery.

No live command is provided as an automatic setup step. Main prepares the exact command only after these artifacts and authority are concrete. --execute also requires explicit --credential-file and --journal-dir; examples cannot execute unchanged.

### Results, billing and failure handling

Private journal files contain scope/counter/status metadata, never input/output text, headers or credentials. The CLI returns text only to the caller; output is not applied or executed. Known-key echoes are redacted, raw reasoning is omitted and raw provider/transport errors are not forwarded. This is deliberate field minimization, not a guarantee against arbitrary secret encodings or a compromised host. Use a trusted Node process and sanitized evidence exports.

A completed response must identify the requested model and return valid input, output, cached-input, reasoning-output and total counters. Cached input is a subset of input; reasoning is already within output. Missing/malformed usage or unexpected tool operations remains unknown, never zero. Tool-call output is rejected. Output/billing-limit violations are escalation outcomes.

Estimated token cost is `((input-cached)*miss_rate + cached*hit_rate + output*output_rate)/1,000,000`. Do not add reasoning or cached input again. Actual billed expense remains unknown until provider reconciliation; do not call an estimate an invoice. Keep DeepSeek request receipts separate from Codex native/subscription consumption.

The original reservation remains held for completed, failed, incomplete, missing-usage, timeout and disconnect outcomes. A timeout can still be billed. No automatic refund, retry, fallback, continuation or blank replacement session occurs. An exclusive partial marker after a crash also blocks replay; main must inspect/reconcile rather than delete it. A later request requires a new specific authorization and accounting for prior known/unknown charges.

One-request and local reservation limits are implemented in the helper; their dollar bound remains conditional on correct current prices/model ceilings, provider behavior and a trusted caller/journal. They cannot prevent a provider from billing differently. Unexpected fees or limit violations halt progress for reconciliation. Disabled tool requests avoid deliberately authorizing separately billed server tools.

### Context reuse and the correction loop

Input accepts bounded user/assistant text messages for explicit replay. This preserves selected text context, not provider-side sessions, reasoning state or native Codex resume. A larger replay changes the fingerprint and must be approved. No reuse saving is presumed.

Main supplies current requirements/source evidence and receives code/test/debugging suggestions. Inspect and apply only authorized changes, run affected tests, provide actionable findings and fresh correction evidence, then use the [review package and rereview loop](reviewer-package.md). Preserve independent Codex review wherever required; a DeepSeek output or coordinator self-review is not independent verification. If a user requires solo preparation, record new independent verification as unperformed rather than claiming it. Complex/repeated failures, uncertainty or exhausted authority return to main/user.

## Path B: optional native Codex worker profile

The inactive example is `config/deepseek-worker.example.config.toml` relative to source/distribution, not the installed skill. The installer never installs it, even with --with-profile. Existing model/default/installed profiles do not change.

A future separately authorized native worker would use a verified user-level profile/catalog and supported client. Do not run a setup script, upgrade, install a profile, write a raw bearer token or override default provider under preparation authority. Inspect effective layered configuration, inherited tools/MCP/agent settings, shell startup and credential-bearing file access. Profile filters/no-login/no-nested-agent requests alone do not prove isolation.

Unlike Path A, the native session may make many model requests despite zero transport retries. Its finite request/time/token/USD dispatch enforcement remains unverified and is a launch blocker. max_tool_calls and idle timeout do not establish a spending cap. Native replay/resume and required tool behavior also need separately authorized live evidence.

## Batched supervision

Reduce coordinator↔worker round trips without weakening gates:

1. Batch independent checks into one dispatch: one reviewer request may cover several completed items when they share a baseline/candidate identity; findings must still name the item each belongs to.
2. Prefer completion or failure events over repeated polling. When waiting is unavoidable, use one bounded wait with a declared deadline rather than repeated unchanged reads; a `--progress` waiting heartbeat is a local timer, never evidence of provider activity.
3. Preserve every gate while batching: approvals stay per-request and fingerprint-bound, one writer at a time, error detection and required independent review are not batched away. A batched review that conflates items or misses one item's verdict is a failed review.
4. Reuse prepared artifacts: deterministic commands from the README maintenance section, existing fixtures/oracles and the context/result validators replace ad-hoc supervision scripts.

## Dynamic allowances and envelope guard

Measured 2026-11-07: high-effort requests exhausted the 8192-token default on reasoning in 5 of 9 attempts and 60s cut real responses (63.9s timeout-only; 145.49s completion at a 32768 budget). `scripts/worker-budget.mjs` sizes allowances by role/model/effort/complexity/risk and prior truncations:

1. Production defaults stay 8192 tokens / 60000ms. Larger allowances (tiers up to 65536/600000) require a per-request `budgetJustification` that is bound into the request scope fingerprint — a changed allowance always means a changed fingerprint, so the existing approval must match it or dispatch is rejected. Policy ceilings and verified model limits are absolute.
2. The planner records4096 tokens of advisory answer headroom. This is a heuristic, not an enforced reasoning/answer partition: reasoning can consume the entire output budget and leave no artifact. Reasoning-only incomplete responses stay incomplete and require reassessment within existing authority; no automatic retry follows.
3. Truncation or timeout is never silently retried: the attempt is preserved with usage evidence, replay is blocked, and a raised-tier attempt requires fresh approval. Two unsuccessful attempts for a work item stop spend and return to the user.
4. Before any dispatch, run the envelope guard over the attempt journals: `node scripts/envelope-check.mjs --journal-dir DIR --envelope envelope.json --planned-reservation USD`. A blocked result (`E_ENVELOPE_REQUESTS`, `E_ENVELOPE_BUDGET`, `E_ENVELOPE_UNKNOWN`) means the authorized count/budget cannot cover the request or liabilities are unknown: return to the user for fresh authority. Held reservations — not optimistic estimates — are the conservative basis.

`planAllowance()` is a decision aid with recorded rationale; it never dispatches or authorizes. Total request/spending authority stays with the user's explicit envelope.

## Completion status

Offline helper tests, syntax, package/install checks and reasoning exercises are preparation. Successful integration requires authorized real request/usage evidence, the relevant development/correction/retesting/review exercise, reconciled expenses and required independent verification. Until then report the exact prepared path and remaining blockers. Do not claim live success, quota savings or provider compatibility beyond observed evidence.
