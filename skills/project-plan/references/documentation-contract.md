# Project documentation contract

Use this reference when planning or revising project documentation. Use established project records as a structural reference. Borrow traceability, not another project's domain rules, approvals or statuses.

## Required output: coverage map
Inspect existing source and records first. Map every applicable area below to its canonical location and owner. Each row must be covered with a link, pending with reason/owner/next gate, or not applicable with a substantive reason. Do not use empty headings or placeholder files as completion. Combine sections for small tasks; split material complexity. Preserve existing names and status ownership.

Core coverage for a meaningful project:
1. Start/navigation, project identity, governing instructions and documentation authority/provenance.
2. User problem, requirements, exclusions, observable success criteria and unsettled semantics.
3. Current behavior versus proposed architecture, components, interfaces/contracts, flows, state/runtime modes, dependencies and trust boundaries sufficient for the work.
4. Design choices/alternatives, stable decisions and open questions/risks with consequences, mitigation and stop conditions.
5. Roadmap/dependency rationale and exactly one work-item status registry.
6. Detailed bounded work items, stable criterion IDs, criterion-to-verification matrix, required roles and readiness/acceptance gates.
7. Validation/delivery/environment map separating proposed commands from actual checks, local tests from hosted CI and deployment.
8. Evidence index, raw artifact locations, source/candidate/tool identities, freshness and reproduction limits.
9. Onboarding, recovery/checkpoint, ownership/uncertain-tool handling and exact next action.
10. Meaningful editable diagrams with sources, rendering/reproduction and visual QA.
11. Dated progress/change history and concise handoff/update templates.
12. A final validation/coverage report and explicit user review/acceptance state.

Conditional dedicated modules include codebase/dependency inventory; domain/data/API contracts; component/current/target architecture; sequence/state/data-flow diagrams; persistence/concurrency/polling modes; security/auth/provider boundaries; CI/deployment/environment setup; performance or migration strategy. Material applicability requires a real record. If no domain database/deployment exists, say so rather than inventing it. Existing sections may satisfy several rows.

## Task detail standard
For each nontrivial task record:
- ID/revision/objective/problem, served requirement IDs and dependency/readiness rationale.
- Current status source, owner/acceptance authority and actual user authorization/conditions/resources.
- Allowed/excluded paths/actions, protected work and baseline source/instruction/runtime/candidate identity; future unknown baselines remain unknown until inspected.
- Approach, alternatives/tradeoffs, planned paths and actual changes/disposition.
- Stable acceptance criterion IDs with observable success, relevant boundary/failure scenarios, expected evidence and actual result (Not run until executed).
- Validation commands/environment, role independence, warnings/skips/failures/corrections and raw evidence.
- Actual what/why/how, task-only diff and candidate identity.
- Reviewer findings/disposition, user result acceptance, named next-task authority and publication separately.
- Risk/decision links, narrow rollback, preservation checks, checkpoint/uncertain tools and resume preconditions.
- Observed usage/attempts/time or unknown, limitations and dated history.

Task notes link the one registry. If statuses are mirrored, synchronize and validate them; do not establish a second authority. Do not infer Ready or Complete from written files, tests or another project's status.

## Ready and completion
Ready requires reviewed scope/files/criteria/dependencies/baseline/validation/recovery; it grants no implementation authority.
A completed technical package needs scoped implementation and actual criterion evidence, review where required, current docs/limitations/checkpoint and separate user acceptance. Publication is a distinct scoped gate. Changed candidates require relevant new checks; evidence for old bytes stays historical.

## Evidence and diagrams
Retain failed attempts and stderr/warnings. Identify static/simulated/native/live/historical evidence explicitly. Record source path, revision/hash, capture time, tool/runtime and raw result location when available. A timestamp cannot refresh changed-candidate evidence. Unknown counters stay unknown; cache/reasoning subsets are not additive savings.

Choose diagrams that answer structural or behavioral questions. Keep editable sources and renders. Check syntax/render output and inspect visual layout; preserve reproduction instructions and actual verification. A diagram of a control is not enforcement proof.

## Finalize and handoff
Validate links (including relevant anchors), tables/escaped separators, YAML/fences, IDs/criteria/dependencies/status mirrors, source copies, diagram assets and protected work as appropriate. Record actual results and limitations. Do not claim Obsidian/UI inspection unless performed. Link the coverage map and records in a small entry page.

Hand off a concise project/task/revision, governing links, exact candidate, verified result, remaining decisions/authority, checkpoint and next action. Main presents any needed approval with simple action/why/effect/decline/recommendation. Neither a complete documentation map nor a ready label starts implementation automatically.

For trivial edits use a concise in-task record satisfying the applicable coverage; avoid a large boilerplate vault. For material missing requirements or authority, narrow the task or obtain the user's decision before execution handoff.
