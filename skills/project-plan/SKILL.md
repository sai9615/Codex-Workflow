---
name: project-plan
description: Finalize a project discussion into requirements, design, useful diagrams and implementation-ready tasks. Use when the user asks to launch the planning workflow or document an agreed plan.
---

Keep the user's invoking conversation as coordinator. Plan directly unless a focused native specialist adds enough benefit to justify its context and coordination cost. Base delegation on complexity, risk, dependencies, available context and expected benefit; no automatic workflow/task-worker layers or arbitrary agent-count limits. Direct coordinator-to-specialist delegation is preferred. A coordinating worker is exceptional and needs a recorded reason; mark its assignment to prevent recursive dispatch. Verify native tools and model/effort support before delegation. If required capabilities are unavailable, report the gap rather than substitute an external model call or weaken required independence.

This efficiency policy applies to every project using this skill. Stronger project validation, isolation and approval requirements remain binding. Prefer successful, verified work per unit of usage; fewer agents alone is not success. Reuse suitable planning sessions through exposed native follow-up tools. Verify actual reuse support before depending on it; persistent resume and compaction are client/version dependent. Fresh context is appropriate when retained context is stale, excessive or costly to reconcile. Reuse does not establish token savings.

Read applicable project instructions and locate the existing authoritative brief, design, task tracker and evidence records. Preserve their locations, vocabulary and history. For a new project, use [record templates](references/project-records.md) and create only useful records. Do not establish a second status registry.

Turn the discussion into requirements, exclusions, acceptance criteria and unresolved decisions. Distinguish observed behavior, proposed design and user-approved decisions. Explain material alternatives and tradeoffs plainly. Add editable diagrams where they clarify architecture, data flow, interactions or dependencies. Create an evidence plan; never fabricate execution evidence.

Define bounded, dependency-ordered tasks with stable IDs, file scope, validation, review and recovery needs. For each task record complexity and risk separately, dependencies, acceptance-specific tests, required independence, initial agent strategy and a short delegation rationale. Simple low-risk work usually needs a developer who validates plus coordinator verification; normal work adds an independent reviewer; complex/high-risk work normally separates development, testing and review. A small security-sensitive change may require the strongest strategy. These are starting choices, not fixed counts; project requirements take precedence.

Execution reuses this assessment and reassesses only for material findings, changed scope/dependencies/risk or unsuitable context. Record significant deviations and their reasons. Propose publication and resource boundaries explicitly; tasks, diagrams and tracker status are not execution authority.

The coordinator gives meaningful progress while active, aiming for updates every few minutes without overriding stricter host instructions. These are foreground updates, not a guaranteed background service. Retain canonical checkpoint/evidence links so a later session can inspect current state and continue deliberately.

Return a concise report naming the actors (including direct coordinator work), outputs, decisions, limitations and next action. Record delegation/reuse decisions, invocations and observed usage/time or unknowns in canonical records; distinguish token counters from subscription quota consumption. Ask for approval of the concrete plan and its implementation scope. Do not begin implementation or delivery simply because planning finished.

Use native Codex capabilities; no new orchestration daemon, dependency installation, model-provider changes or global settings are part of this workflow. Skills guide behavior; they do not enforce tamper-proof receipts, locks or sandbox boundaries.

## Documentation coverage

For project documentation planning/finalization, read [the documentation contract](references/documentation-contract.md). Produce a coverage-to-canonical-location map and the required detailed task/evidence/standards/decision/risk/recovery records. Reuse existing structure; combine small records or give reasoned N/A dispositions. Validate the applicable package before handoff; unresolved material requirements or authority cannot be hidden by empty headings.

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
