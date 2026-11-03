# Minimal project records

Reuse existing records first. Select one canonical tracker, identify its owner and preserve history. Scale detail to project complexity. Do not force all projects into a fixed documentation tree.

For a new project, these records may be combined when small, but must satisfy [the documentation coverage contract](documentation-contract.md). Produce a coverage map first; material architecture, contracts, risks, decisions, standards, onboarding, reproduction and detailed task verification need substantive coverage rather than empty headings. Store large logs once; link them from tasks. Record sources for factual claims. Keep secrets and transient machine state out of published records.

## Project brief

- User problem and intended outcome.
- In-scope requirements and explicit exclusions.
- Observable acceptance criteria.
- Current architecture, constraints and evidence.
- Proposed decisions, approved decisions and unresolved questions.
- Canonical documentation and tracker locations.

## Task record

- ID, revision, objective, dependencies and status.
- Approved scope, affected files and exclusions.
- Authorization: user decision, covered actions, conditions and resources.
- Acceptance criteria and required validation/review.
- Candidate: checkout, baseline revision and relevant dirty-work identity.
- Actual changes, commands, results, warnings, skips and evidence links.
- Independent review, findings and corrections.
- User acceptance, next-task decision and publication authority separately.
- Recovery/checkpoint and last update.

## Checkpoint

Record project/task identity, governing instructions and approved revision, stage, completed work, evidence locations, worker thread IDs when available, known active tools/processes, unresolved issues and exact next action. Record usage/time only when observed; unknown stays unknown.

At resume, re-read governing records and inspect checkout/instruction/evidence drift. A checkpoint is not permission to duplicate work, steal ownership, replay an approval or assume an interrupted process exited.

## Diagram selection

Use a component/data-flow diagram for boundaries, a sequence diagram for interactions, or a task dependency diagram when ordering matters. Keep editable sources alongside rendered artifacts where useful. Do not generate diagrams solely to increase document count.
