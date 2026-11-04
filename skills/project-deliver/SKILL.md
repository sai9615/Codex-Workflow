---
name: project-deliver
description: Publish accepted project changes under explicit authority and verify exact-commit CI and authorized deployment. Use when the user invokes delivery or authorizes commit, push, merge, release or deployment.
---

Keep the invoking conversation as coordinator. Apply the cross-project efficiency policy: reuse the approved complexity/risk/context assessment and choose direct delivery or a focused native specialist only when delegation adds value. No automatic fresh workflow/task worker or arbitrary agent-count limit. Prefer direct coordinator-to-specialist delegation; record the reason for an exceptional coordinating worker and prevent recursive dispatch. Verify native capability and model/effort support before delegating; required independence and project safeguards remain binding.

Reuse a suitable delivery session through exposed follow-up tools after verifying role history, scope, current evidence, settings and authority. Start fresh for stale/excessive context or risk requiring a new perspective. Give only relevant canonical pointers, candidate, destination/effects and authority; avoid full transcript inheritance and repeated unchanged-document reads. Checkpoint before supported compaction/handoff; verify actual client support before relying on persistent resume. Reuse does not establish lower token or subscription usage. Missing capabilities must be reported, not replaced by external model calls or weakened checks.

Read applicable instructions, task acceptance, the exact candidate and publication authority. Inspect branch, destination, scoped diff and unrelated dirty work. Inspect pipeline triggers before publication, including deployments caused automatically by a push. Do not assume tests prove a push or deployment has no harmful effects.

When authority is missing, prepare the exact reviewable changes, destination, expected pipeline/deployment effects, validation and recovery approach, then request the missing authorization. Existing explicit authority persists; do not ask again within its scope. The default requires user authorization for publication and deployment. The user may separately define a bounded standing delivery policy; do not invent it from test success or a question about automation.

Perform only the authorized commit, push, PR, merge, release and deployment actions. Preserve unrelated work; never stage all files indiscriminately or bypass checks. Correlate the published commit SHA, required CI runs and delivery artifacts. Observe CI automatically within authorized read access, but do not confuse observation with permission to trigger a mutating workflow.

For failures, gather actual logs and explain their cause. Correct or retry only within the recorded task/delivery authority and relevant retry limits. Material changes require updated candidate evidence and review. Never silently force-push, merge, deploy, roll back or repeatedly retry publication.

Where deployment is authorized, correlate its version/artifact to the published SHA and run the agreed health checks. A successful push, an older green run or an uncorrelated healthy endpoint is insufficient proof of delivery.

Update canonical evidence/checkpoint records using [the delivery report](references/delivery-record.md). The coordinator gives meaningful progress updates while active, aiming for every few minutes subject to stricter host instructions. Use the host's native approval UI; phone approval is available only after actual account/device setup is verified. Do not build a notification/approval service or claim notification delivery without evidence.

Return the exact result, CI/deployment status and remaining decisions to the coordinator. Do not automatically start another task or workflow without its applicable authority.

## Documentation maintenance

Use the project's documentation coverage and authority map. Before publication, confirm required scoped implementation/test/review and user acceptance records belong to the exact candidate. Record actual destination/effects, commit, CI/deployment outcomes, limitations, recovery and checkpoint using [the delivery checklist](references/delivery-record.md). Keep evidence and registry consistent without rewriting historical logs; document unavailable hosted stages explicitly. Documentation status alone never authorizes publication.

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
