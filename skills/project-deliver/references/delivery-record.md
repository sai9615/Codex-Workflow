# Delivery verification record

Keep this record in the existing project's evidence location, linked from its task.

- Task/result revision and user acceptance.
- Publication authorization: actions, destination branch/repository, environment, automatic trigger effects and conditions.
- Scoped diff and validation/review evidence.
- Published commit SHA and PR/release links where applicable.
- Required CI checks: run IDs/links, correlated SHA, actual status/conclusion and material logs.
- Authorized deployment: environment, version/artifact identity, correlated SHA and agreed health-check results.
- Failed attempts/retries and their authority; unknown or incomplete verification.
- Actors, spawn/follow-up/reuse decisions, requested/observed settings, observed time and input/output/cached tokens or unknowns, including coordination and failed attempts where exposed. Avoid duplicate cumulative/subset counts; subscription quota is separate from tokens.
- Recovery approach and actions actually performed.
- Final outcome and next user decision.

Report local checks, hosted CI and deployment separately. Awaiting CI is pending, not passed. Verify that check results belong to the exact published candidate; a prior green run does not validate a new change.

The default policy asks the user before publication/deployment. Passing checks can satisfy a previously approved bounded policy, but cannot create that policy.

## Completeness and handoff

Use stable task/criterion/attempt identities and the project's canonical documentation map. Link implementation/test/review and actual user acceptance to the published candidate. Record automatic trigger effects, actual commands/exits/warnings/failures, exact SHA/artifact/run links, remaining gates and narrow recovery. Update delivery evidence/checkpoint and registry coherently; keep earlier results historical and unknowns explicit.

Before handoff, verify required relative/wiki links, scoped file/criterion references, source-copy provenance and relevant diagrams/reproduction docs remain current. Do not publish a changed candidate using old evidence. Local tests, hosted CI and deployed health are independent claims; mark unperformed stages Not run. Keep task reports detailed on disk and user updates concise.
