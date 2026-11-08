# Native Codex Workflows

Three reusable Codex skills help you plan a project, carry out an approved task, and publish an accepted result. Your main chat assesses each task and delegates directly to focused native agents when their benefit justifies the cost. Relevant role sessions can be reused; validation, required independence and human approval remain part of every project using these skills.

| Skill | Ask it to do | What you get |
| --- | --- | --- |
| `project-plan` | Turn your idea or discussion into a workable plan | Requirements, design, bounded tasks and a validation plan |
| `project-execute` | Complete a named, approved task | Risk-appropriate development, validation, review and a result report |
| `project-deliver` | Commit or publish an accepted result | A scoped commit/push and verification of the exact published revision |

These are instructions for Codex, with a small local installer. They do not run a separate agent service. You sign into Codex normally; credentials and chat history are never included in this repository.

## Default workflow

The optimized workflow is the default for all three skills. The main chat keeps ownership of the task, uses the planning assessment to decide when specialists are useful, and delegates directly when needed. Relevant sessions can be resumed after checking their scope and context. Required testing, independent verification, user acceptance and publication approvals stay in place.

For explicitly authorized DeepSeek-enabled work, use Codex coordinator → DeepSeek developer → separate DeepSeek tester → separate DeepSeek reviewer → risk-based Codex verification. Prefer V4.1 Flash for routine work and V4 Pro for complex/high-risk work; both default to high reasoning. xhigh is unsupported by current metadata; max needs scoped justification. Testing and independent initial review are mandatory. Final Codex verification checks concise low-risk evidence and investigates high-risk work more deeply. Codex keeps its existing provider. A no-agent/solo instruction blocks worker launches and leaves independent/live criteria pending.

Local validation has exercised the policy on a synthetic comparison and a historical application-validation replay. Both retained their required tests and independent review. These are bounded observations with setup, context, cache and accounting limitations; they do not establish a general percentage saving or subscription-quota reduction. Measure complete task usage in your own runtime. Private project records and raw evidence are not part of this package.

## Start on a new computer

You need Git, Node **24.22.1 or a later Node 24 release**, and a Codex installation with native agent delegation available. No npm dependencies need installing. The optional profile requests **GPT-6.1 Sol / Medium** for the main session and spawned agents. Verify that your account/runtime supports those settings; an unavailable setting must be reported rather than silently substituted.

```sh
git clone https://github.com/sai9615/Codex-Workflow.git native-codex-workflows
cd native-codex-workflows
node scripts/install.mjs --user --with-profile --dry-run
node scripts/install.mjs --user --with-profile
```

The first installer command previews the paths without writing. The second copies the three skills into `~/.agents/skills/` and the optional profile into `~/.codex/native-workflows.config.toml`. It leaves your existing `config.toml`, login, permissions, and other skills alone. Identical copies are skipped. If a skill/profile differs, the installer stops before writes: back up and review the old version before replacing it. It does not overwrite conflicting files or follow symlinked installation targets.

Open **your actual project folder** in Codex, rather than this distribution repository. Skills are discovered from the user installation. If they do not appear in the skill picker, restart Codex. Avoid installing another copy of the same skill into the project unless you intentionally want both scopes.

For a new CLI session in your project:

```sh
cd /path/to/your-project
codex --profile native-workflows
```

For the desktop app, select GPT-6.1 Sol and Medium in the model/reasoning picker before starting work. Installing a profile does not change a running chat. Explicit spawn settings and custom agent settings can override defaults; these files are workflow guidance, not proof that a hidden runtime honored them.

## What to say to Codex

Start with a clear goal. You can use the skill picker or mention the skill by name.

**Plan a project:**

```text
Goal: Add a searchable notes page to this app.
Use $project-plan. Read this project's AGENTS.md and existing docs first.
Keep this chat as coordinator. Delegate focused planning work only when useful.
Prepare a small design and task list. Bring the concrete plan back here before implementation.
```

Review the plan, resolve any open decisions, then authorize one named task:

```text
Approve the plan for TASK-001 only. Goal: Complete that task's acceptance criteria.
Use $project-execute with the planned risk-appropriate strategy and direct native specialists when needed.
Preserve unrelated changes. Bring questions and approvals to this main chat.
Report the exact tested result for my acceptance. No commit, push or deployment yet.
```

After accepting a result, name the publication actions and destination you want:

```text
I accept TASK-001. Use $project-deliver; choose direct delivery or a suitable native specialist based on risk and context.
Commit only its reviewed files and push to my existing REPOSITORY on BRANCH.
Check automatic pipeline effects first; ask here if deployment effects are outside this scope.
Verify the remote commit and relevant CI. Do not merge or deploy.
```

Replace task IDs, repository and branch with real values. Existing authorization is reused within its scope; you do not need to approve every routine command. A new task, changed scope or publication outside that scope needs its own decision.

## Installing for one project instead

If you want the skills checked into a particular project's `.agents/skills/` directory instead of a user installation:

```sh
node scripts/install.mjs --project /path/to/existing-project --dry-run
node scripts/install.mjs --project /path/to/existing-project
```

This copies only the three skill folders. It does not edit the project's `AGENTS.md`, install a user profile, create a Git commit, or copy your tracking notes. Review any changes before sharing them. If an OS write fails mid-install, inspect the reported targets before retrying; the installer does not remove existing files to recover.

## Keep code and tracking notes separate

A simple local layout is:

```text
workspace/
  native-codex-workflows/   # this Git repository
  workflow-notes/           # your local Obsidian vault, tracker and evidence
  your-project/            # the application you are working on
```

Clone and publish only the code repository. Keep project status, private task notes, raw logs, screenshots and machine state in the local notes folder. Tell Codex the actual canonical tracker/checkpoint paths when starting or resuming; do not make it guess a similarly named vault. Existing project record locations stay authoritative.

The Markdown under `skills/*/references/` ships because the skills need those generic forms and checklists. It contains no project execution history. Obsidian is optional for using the workflows. Cloning restores the workflow package; transferring private notes and resuming a project's state are separate actions.

## How work and approvals behave

Planning records complexity, risk, dependencies, required tests/independence and an initial agent strategy. Execution reuses it and records material changes. Simple low-risk tasks usually combine development and validation with coordinator verification; normal tasks add an independent reviewer; complex/high-risk tasks normally separate developer, tester and reviewer. Stronger project requirements take precedence. There is no fixed agent-count limit, mandatory workflow/task-worker layer or automatic fresh agent per stage.

The coordinator prefers direct delegation and suitable role-session reuse after checking current scope, role history, context and settings. An implementation session cannot independently verify its own work. Reused reviewers inspect the current diff and raw evidence; fresh reviewers remain appropriate for architecture, trust-boundary risk or contaminated context. Native follow-up, persistent resume and compaction differ by runtime/client: verify exposed support, preserve checkpoints and report gaps. A supported interface does not prove reuse savings.

Independent reviewers start from a [compact context package](skills/project-execute/references/reviewer-package.md) linking requirements, the actual diff and candidate identity, dependencies, raw checks and open risks. They verify freshness and inspect further authorized source whenever needed; missing evidence cannot become a passing conclusion. For corrections, the same suitable developer reruns affected checks and the same suitable independent reviewer starts with prior findings, the correction diff and updated evidence. Review expands for dependencies, risk, unexpected changes or stale/contaminated context. Reuse remains conditional on role and context compatibility. Keep project-specific packages and raw logs in your existing evidence location outside this repository.

All user questions and permission requests return to the main chat. Workers may act within their existing scope, but cannot decide a missing user approval themselves.

If an approval is part of the test, the coordinator must show you the actual request and wait for your answer. A worker's proposal reaching the coordinator is not a user approval. Simulated refusals, actual user refusals, chat approvals and native sandbox dialogs must be reported separately.

Tests and reviewer verdicts do not accept your result or authorize the next task. Delivery needs explicit scope, and a push can trigger CI or deployment. A workflow checks those effects before publication. A checkpoint records progress; resumption checks the current files and active/uncertain work before repeating anything.

Role instructions do not create separate OS sandboxes, and this package does not guarantee quota/crash recovery, phone approvals, background monitoring, token accounting or deployed health. If native delegation is unavailable, report the gap; direct work is suitable only when all required checks and independence can still be satisfied. Native Codex defaults remain Sol / Medium with scoped approval for High. Explicitly authorized DeepSeek workers use the hybrid high-effort policy.

## Efficiency evidence and adoption

Record agent spawns/follow-ups, reuse decisions, observed input/output/cached tokens and elapsed time, including coordination, failures and corrections where exposed. Missing telemetry stays unknown; cached/reasoning subsets and cumulative counters must not be double counted. Subscription quota consumption is separate from token measurements. No savings are established merely by reusing a session or reducing agent count. See the [benchmark protocol](skills/project-execute/references/efficiency-validation.md) for cheap decision checks followed by separately bounded native comparisons.

These defaults apply across projects loading the updated skills. Existing project-local copies or stricter project instructions require explicit reconciliation; updating this repository does not update installed copies or running chats. The installer intentionally refuses conflicting destinations. Back up and review a concrete replacement before separately authorized adoption; do not delete a conflicting installation to bypass its checks. Publication remains separately authorized.

## Optional DeepSeek worker paths

[DeepSeek worker guidance](skills/project-execute/references/deepseek-workers.md) covers hybrid role selection and an [inactive profile example](config/deepseek-worker.example.config.toml) prepares a future opt-in native worker. Codex keeps coordination and risk-based verification, preserving stronger independent Codex-review requirements. The installer does not install the example or change current provider defaults. It uses an environment-key name, never a credential.

Native compatibility, resume, credential isolation and finite session spending controls need separate verification. A previously observed client 0.141.0 was below the guide's catalog minimum 0.144.0; verify the actual current client before that route. The one-request helper below implements bounded dispatch/reservations without native workers. No catalog is bundled. Native subagents cannot be assumed to switch provider through a role file. Separate authority, credentials and finite limits are required before external worker/API calls. A helper connectivity smoke is not proof of native integration or complete developer/tester/reviewer validation. No adoption, upgrade or setup-script execution is implied.

## Validate and build the portable package

```sh
npm run test:run
npm run build
```

The tests exercise installation, conflict preservation and package boundaries in temporary directories. They make no model or network calls. The build validates the skills and local links, then copies an explicit file allowlist into `dist/native-codex-workflows/` with a SHA-256 `manifest.json`. That directory is a complete portable copy; its installer works without the original checkout. `dist/` stays out of Git because the source rebuilds it.

## Deterministic maintenance commands

Run from the repository root with Node `>=24.22.1 <25` (no dependencies to install). These commands resolve from any checkout path, including paths containing spaces, and are the only validation entry points; do not recreate ad-hoc scripts for the same checks.

```sh
npm run test:run        # full offline test suite (node --test test/*.test.mjs)
npm run build           # validate skills/links, rebuild dist/ with SHA-256 manifest
npm run validate        # package boundary and file-list checks

# Scoped accounting over helper attempt journals (read-only, no network/credentials):
node scripts/journal-aggregate.mjs --journal-dir PRIVATE_DIR [--scope-map scope.json]

# Pre-dispatch envelope guard (blocks when authorized count/budget cannot cover a request):
node scripts/envelope-check.mjs --journal-dir PRIVATE_DIR --envelope envelope.json --planned-reservation USD
```

Package tests verify the installer and static distribution. They do not certify live Codex behavior on every host. There are no hosted CI or deployment workflows in this repository.

## Files and official guidance

- [Planning skill](skills/project-plan/SKILL.md)
- [Execution skill](skills/project-execute/SKILL.md)
- [Delivery skill](skills/project-deliver/SKILL.md)
- [Optional CLI profile](config/native-workflows.config.toml)

Discovery/install paths follow the [official OpenAI skills documentation](https://learn.chatgpt.com/docs/build-skills). See [configuration basics](https://learn.chatgpt.com/docs/config-file/config-basic) for profile precedence, and [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) for native delegation and inherited permissions. Check current official guidance if your client behaves differently.

## Optional bounded DeepSeek requests

The Codex coordinator provider is unchanged. An optional dependency-free helper at
`scripts/deepseek-worker.mjs` sends one approved text-only Responses request and
returns untrusted text for the existing coordinator to inspect, apply, test and
review. It launches no native agents, executes no returned tools and performs no retry
or provider fallback. Each correction needs its own explicit request approval.

Requests default to high reasoning. The helper also supports an independent review
role, explicit justified max effort, and requested-versus-provider-reported effort
evidence. Its offline selectWorker export chooses a baseline model using complexity,
risk and failure history; it does not launch roles or grant authority. Existing
coordinator search tools supply up-to-date research with primary sources; this
helper keeps provider-side search disabled to preserve bounded tool spending.

For authorized live requests, --progress adds sanitized local status/elapsed-time
events to stderr. Waiting events are local heartbeats, not provider progress or
live token readings. Native show_raw_agent_reasoning controls display separately;
the helper does not stream or persist raw reasoning. See the worker contract for
visibility limits and the [new-model benchmark protocol](skills/project-execute/references/efficiency-validation.md#new-deepseek-flash-versus-pro-comparison).

Offline fingerprint preview (no key read or network):

```sh
node scripts/deepseek-worker.mjs --request config/deepseek-request.example.json
```

The [request example](config/deepseek-request.example.json) and
[approval example](config/deepseek-approval.example.json) are inactive placeholders.
Live execution requires an exact nonexpired user approval, verified current model
prices and full billing ceilings, a sufficient USD reservation, a protected
credential file and an owner-private journal directory. The helper claims an
exclusive attempt marker before one POST and retains uncertain reservations.
A price/configuration receipt records authority; it cannot independently prove
that a person approved it or that provider billing matches declared limits.

Read the [worker contract](skills/project-execute/references/deepseek-workers.md)
before preparing a live command. Mocked offline tests establish local behavior,
not successful provider execution, invoice charges or independent review.
The optional native Codex CLI profile is a separate, still-unverified path.
