---
name: project-execute
description: Coordinate approved project tasks through development, testing, independent review and evidence-backed reporting. Use when the user asks to launch the implementation workflow or resume authorized execution.
---

Keep the invoking conversation as coordinator and apply this efficiency policy to every project using the skill. Reuse the approved planning assessment: complexity, risk, dependencies, testing and required independence. If it is absent, record a concise assessment in the existing task record before implementation. Choose the simplest strategy that satisfies those requirements; no automatic workflow/task-worker layers or arbitrary agent-count limits. Prefer direct coordinator-to-specialist delegation. A coordinating worker is exceptional and needs a recorded benefit and explicit nonrecursive assignment.

Verify exposed native delegation/follow-up tools, capacity, permissions and model/effort support before dispatch. Reassess only when material findings, changed requirements/dependencies/risk or context condition justify it; record significant deviations and escalate changes that exceed authority. If required independence or a specifically mandated topology cannot be provided, report the gap before dependent work. Do not silently weaken safeguards, launch external model sessions or change global settings. Separate threads are not independently managed top-level UI sessions.

Read applicable instructions, the canonical tracker, approved task revisions and existing checkpoints. A proposed or ready task is not permission to execute. Verify dependencies, scope, checkout/baseline and unrelated dirty work. Preserve existing changes and evidence. Keep one writer per task checkout; use disposable isolation when supported, but do not assume a clean worktree contains the user's uncommitted work.

Every task receives implementation, appropriate validation and review. Use the planning strategy as the starting point:
- Simple, low risk: developer implements and validates; coordinator inspects the actual candidate/diff and raw evidence.
- Normal: developer implements and runs relevant tests; independent reviewer examines requirements, candidate and validation evidence.
- Complex or high risk: developer implements; independent tester validates acceptance criteria; independent reviewer examines the changes and evidence.

Stronger project requirements take precedence. Complexity and risk are separate; small sensitive changes can need independent testing and review. The coordinator may perform bounded implementation when justified, but its own review is not independent verification. Never weaken tests or omit essential independent verification to save usage. Parallelize only independent work with a concrete benefit and safe ownership; preserve one writer per checkout.

Prefer reusing a relevant developer, tester or reviewer session through available native follow-up tools. Check task/project scope, role history, context freshness, current candidate and model/permission compatibility. Never reuse an implementation session as its own independent tester/reviewer. A reviewer can revisit corrections or related tasks but must inspect the current requirements, actual diff and raw evidence on every pass; prior opinions and developer summaries are insufficient. Use fresh reviewers when architectural significance, trust-boundary risk, anchoring or context contamination warrants it. Start fresh for excessive/outdated context; reuse is not presumed cheaper.

Give each specialist only the exact project/task authority pointers, scoped objective, relevant files, baseline/candidate identity, criteria and evidence links. Prefer bounded assignments over full-history forks when supported. Store raw logs once and return concise findings. Avoid rereading unchanged material after checking relevant identities; re-read affected instructions and records on drift. Before supported compaction or handoff, checkpoint decisions, implementation history, findings and active/uncertain work. Verify client support before relying on resumption or compaction; a saved thread does not restore files, processes or approvals.

For each independent review, prepare and use the [compact reviewer context package](references/reviewer-package.md). The reviewer starts at its entry point, verifies the actual candidate and raw evidence, and inspects further authorized source as needed. Missing or stale essential evidence must be reported before an affected PASS conclusion.

Role instructions do not enforce read-only permissions: children inherit the parent sandbox/provider. If separately enforced reviewer isolation is required, verify an available restricted session and boundary before running; otherwise report the gap. Do not claim stronger sandbox guarantees from skill instructions alone.

Resolve actionable findings within approved scope using the [correction and rereview loop](references/reviewer-package.md#correction-and-rereview-loop). Return location, impact and required correction to the same suitable developer, rerun affected validation, then give the correction package to the same suitable independent reviewer. Verify role/context compatibility before reuse; expand inspection or use a fresh reviewer when risk or context requires it. Any correction creates a changed candidate: rerun affected validation and review. Escalate significant design, scope, trust-boundary, behavior, dependency or resource changes with a concrete recommendation. Ordinary in-scope implementation decisions do not need another approval.

Maintain canonical task/checkpoint records and evidence links. The coordinator reports meaningful progress while active, aiming for every few minutes subject to stricter host instructions. Keep current stage, verified results, blockers and next step clear. Native waiting/events should avoid wasteful polling. No guaranteed monitoring continues after the coordinator stops.

At an agreed resource boundary, cooperatively checkpoint and request continuation as required. Preserve files, tool state, partial evidence and unknown usage. Do not kill work, silently retry, switch providers, or start a new empty session because a token threshold was reached. Ordinary timeout/cancellation handling remains governed by the approved task and host policy.

After EACH task, use [the task report](references/task-report.md), return to the coordinator and wait for the user's explicit result/continuation decision. Never auto-accept the result or start the next task. If the reply is ambiguous, clarify only that decision. Permission for another task does not imply commit, push, merge or deployment authority.

Invoke project-deliver only when the necessary publication actions and automatic deployment effects are authorized; choose direct or delegated delivery using its risk and context assessment. Native CI observation is allowed within the current task's read scope; passing tests alone never authorizes publication. End with a durable checkpoint and an accurate awaiting-approval, completed, partial or blocked outcome.

## Usage and efficiency evidence

Record task/attempt and actor IDs, role, spawn versus follow-up, reuse/fresh rationale, requested and observed model/effort, wall time, tests/review/correctness, and native input/output/cache counters when available. Include root coordination, failed attempts, corrections, compaction and auxiliary work where observable. Preserve unknowns; do not sum cumulative snapshots or count cached-input/reasoning subsets twice. Token measurements and cache hits do not establish subscription quota savings. Avoid redundant tools/analysis and polling; use native events/waits when supported. Unexpected resource needs follow the existing authorization/budget checkpoint rules, not invented thresholds or automatic restarts.

For comparisons, use [the benchmark protocol](references/efficiency-validation.md). Start with offline checks; costly live comparisons require bounded authority. Do not claim efficiency improvements from agent counts, bytes or unmeasured reuse.

## Documentation maintenance

Before execution, locate the project's documentation coverage map and canonical task/evidence/decision/risk/checkpoint records. For nontrivial tasks, preserve scope/baseline and criterion-to-verification mapping; update actual what/why/how, files, results, findings, recovery and history with the registry. If material coverage is missing, report the gap to main and narrow/resolve it before dependent work. Apply [the detailed reporting checklist](references/task-report.md); do not generate competing ledgers or mark criteria verified from plans.

## Approval routing

Only the invoking main coordinator may ask the user questions or request tool/sandbox approvals. Delegated workflow, task and specialist workers must not invoke escalation/approval tools. If an action needs permission they do not have, return its exact proposed command or patch, target paths, purpose, expected effects and relevant preconditions to the main coordinator, then wait. The coordinator presents one concrete request in the main thread and performs the approved bounded action or returns its verified result to the worker. Existing scope authorization does not transfer tool permissions. Resolve or cancel any uncertain pending request before issuing a replacement; never duplicate an uncertain action. Routine actions already permitted by a worker's sandbox may proceed within assigned scope.

When the authorized task explicitly tests a user approval or refusal, main must present the concrete action in the main chat and wait for the user's actual answer before the gated action. A worker-to-coordinator proposal, coordinator decision or simulated refusal is not a user decision. Record separately which branch actually ran; do not claim a sandbox dialog or phone approval from a chat response. Routine actions already covered by the user's scope do not need repeated approval.

## Explain approval requests clearly

Request approval only when authority is genuinely missing or a consequential user decision is required. Do not repeat an approval already granted within its scope.

Use plain language and scale detail to the decision. Before asking, explain:
- The concrete action and its scope: which files, task, repository, branch or environment it affects.
- Why it is needed and why approval is required. Distinguish an app/filesystem permission prompt from a design, acceptance, publication or deployment decision; name the applicable boundary.
- What approving will change and the expected benefit, material risks or side effects, including automatic deployment triggers where relevant. Explain reversibility when it matters; do not imply passing tests remove all risk.
- What happens if the user declines or postpones, and any practical safer or narrower alternative.
- Your recommendation and one clear, specific approval question.

Avoid unexplained jargon, vague requests such as "proceed?", and bundles of unrelated permissions. Link the concrete diff, report or evidence when useful. Keep simple file-write requests short and give higher-impact decisions enough detail to understand the consequences. Put sufficient context in the actual app approval prompt as well as the main-thread explanation. Do not add hypothetical warnings or new approval gates.

## Model and reasoning policy

Use gpt-6.1-sol with reasoning_effort=medium for the coordinator, workflow workers, task workers, developers, testers and reviewers. Set both model and effort explicitly when native spawn controls support them; do not rely on inherited settings from an unverified parent or a custom role override. Record the requested settings and actual observed settings when exposed. Do not claim successful enforcement from instructions or a model's self-description alone.

High on the same gpt-6.1-sol model is an exception requiring PRIOR explicit user approval through the main coordinator. Explain the exact reasoning obstacle, evidence that Medium is insufficient, what High would do, the bounded task/agent/stage, expected latency/usage impact (unknown quantities stay unknown), alternatives and consequences of declining. Do not raise effort merely because a role is a reviewer or the task is called complex. Bind an approved exception to that scope, record it, and use Medium again afterward.

Other models/efforts are not authorized by this policy. If the selected runtime cannot request or verify the intended setting, report that capability gap in main before launching affected work; do not silently substitute a model/provider. Only the user/client controls can change an already-running coordinator's model. A separately selected native-workflows launch profile sets root and child defaults; it does not change existing sessions, override every role or enforce the approval rule by itself.
