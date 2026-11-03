---
name: project-execute
description: Coordinate approved project tasks through development, testing, independent review and evidence-backed reporting. Use when the user asks to launch the implementation workflow or resume authorized execution.
---

Keep the invoking conversation as coordinator. Start a fresh native workflow-worker thread with a compact assignment and an explicit worker marker; never recursively launch the same workflow. Give each task a new task thread. Within that task, use sequential developer, tester and fresh reviewer threads where native nesting and capacity support them. Verify these capabilities before dispatch. If this topology is unavailable, explain it and ask before changing the requested topology; do not silently flatten it, launch external model sessions or change global settings. Separate native threads are not a promise of independently managed top-level UI sessions.

Read applicable instructions, the canonical tracker, approved task revisions and existing checkpoints. A proposed or ready task is not permission to execute. Verify dependencies, scope, checkout/baseline and unrelated dirty work. Preserve existing changes and evidence. Keep one writer per task checkout; use disposable isolation when supported, but do not assume a clean worktree contains the user's uncommitted work.

Developer implements the approved task and records the candidate/diff. Tester validates acceptance criteria using appropriate actual checks; do not weaken tests to manufacture a pass. Reviewer independently inspects the task, exact candidate and raw validation evidence in a fresh context, without relying only on the developer summary. Give specialists minimal relevant context, not the entire coordinator transcript.

Role instructions do not enforce read-only permissions: children inherit the parent sandbox/provider. If separately enforced reviewer isolation is required, verify an available restricted session and boundary before running; otherwise report the gap. Do not claim stronger sandbox guarantees from skill instructions alone.

Resolve findings within approved scope. Any correction creates a changed candidate: rerun affected validation and review. Escalate significant design, scope, trust-boundary, behavior, dependency or resource changes with a concrete recommendation. Ordinary in-scope implementation decisions do not need another approval.

Maintain canonical task/checkpoint records and evidence links. The coordinator reports meaningful progress while active, aiming for every few minutes subject to stricter host instructions. Keep current stage, verified results, blockers and next step clear. Native waiting/events should avoid wasteful polling. No guaranteed monitoring continues after the coordinator stops.

At an agreed resource boundary, cooperatively checkpoint and request continuation as required. Preserve files, tool state, partial evidence and unknown usage. Do not kill work, silently retry, switch providers, or start a new empty session because a token threshold was reached. Ordinary timeout/cancellation handling remains governed by the approved task and host policy.

After EACH task, use [the task report](references/task-report.md), return to the coordinator and wait for the user's explicit result/continuation decision. Never auto-accept the result or start the next task. If the reply is ambiguous, clarify only that decision. Permission for another task does not imply commit, push, merge or deployment authority.

Invoke project-deliver in a fresh worker only when the necessary publication actions and automatic deployment effects are authorized. Native CI observation is allowed within the current task's read scope; passing tests alone never authorizes publication. End with a durable checkpoint and an accurate awaiting-approval, completed, partial or blocked outcome.

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
