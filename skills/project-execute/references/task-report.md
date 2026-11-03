# Per-task report

Keep the user-facing report simple but sufficiently detailed to review. Put raw logs and long provenance in linked evidence.

- Task ID and objective; current outcome.
- What changed and which files were affected.
- What the developer, tester and reviewer each did; include worker identifiers when available.
- Actual validation results, material warnings/skips, reviewer findings and their disposition.
- Known limitations and unresolved decisions.
- Observed time and provider usage, including retries and auxiliary agents when available. Keep missing totals unknown; cached input/reasoning subsets must not be double counted.
- Canonical evidence and exact candidate/diff identity.
- Proposed next task, why it is next, and any change in authority required.

Ask explicitly whether the user accepts this result and authorizes the named next task. The user may accept, request changes, stop, or authorize continuation with conditions. Record the exact scope of the answer. A generic yes applies only to the concrete choice presented, not later tasks or publication.

A reviewer verdict and passing tests are evidence, not user acceptance. If the user requests corrections, preserve prior findings/evidence, correct within scope and provide another report before continuing.

## Resuming

Read the tracker and checkpoint; verify current files, instruction scope and evidence. Check for active owners and processes before repeating a stage. Changed scope or uncertain delivery requires clarification rather than a blind resend. Do not claim a saved conversation restores running processes, filesystem state or approval validity automatically.

## Detailed canonical record and documentation checks

The concise user report links a complete task record: objective/problem and requirement IDs; exact authority and scope/exclusions; baseline/instruction/runtime/candidate identity and protected work; dependencies; approach/actual files; stable acceptance IDs and criterion-specific actual evidence; commands/exits/assertions/warnings/skips/failures and corrections; roles/review; acceptance/next-task/publication separately; risks/decisions; narrow rollback and checkpoint; observed usage/unknowns and dated history.

Maintain the existing project's documentation coverage map, architecture/contracts and decision/risk registers when affected. Validate applicable links/tables/criterion IDs/dependencies/status mirrors and evidence freshness. Preserve one status authority and original logs. A future scenario stays Not run. Do not create domain modules irrelevant to a trivial change.
