# Native Codex Workflows

Three reusable Codex skills help you plan a project, carry out an approved task, and publish an accepted result. Your main chat stays in charge while fresh native agents handle focused work.

| Skill | Ask it to do | What you get |
| --- | --- | --- |
| `project-plan` | Turn your idea or discussion into a workable plan | Requirements, design, bounded tasks and a validation plan |
| `project-execute` | Complete a named, approved task | Development, independent tests, fresh review and a result report |
| `project-deliver` | Commit or publish an accepted result | A scoped commit/push and verification of the exact published revision |

These are instructions for Codex, with a small local installer. They do not run a separate agent service. You sign into Codex normally; credentials and chat history are never included in this repository.

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
Use native workflow agents for this planning task. Keep this chat as coordinator.
Prepare a small design and task list. Bring the concrete plan back here before implementation.
```

Review the plan, resolve any open decisions, then authorize one named task:

```text
Approve the plan for TASK-001 only. Goal: Complete that task's acceptance criteria.
Use $project-execute with native workflow, task, developer, tester and reviewer agents.
Preserve unrelated changes. Bring questions and approvals to this main chat.
Report the exact tested result for my acceptance. No commit, push or deployment yet.
```

After accepting a result, name the publication actions and destination you want:

```text
I accept TASK-001. Use $project-deliver with a fresh native delivery worker.
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

Execution uses a fresh workflow worker, a fresh task worker, then sequential developer, tester and fresh reviewer roles where the host supports that nesting/capacity. All user questions and permission requests return to the main chat. Workers may act within their existing scope, but cannot decide a missing user approval themselves.

If an approval is part of the test, the coordinator must show you the actual request and wait for your answer. A worker's proposal reaching the coordinator is not a user approval. Simulated refusals, actual user refusals, chat approvals and native sandbox dialogs must be reported separately.

Tests and reviewer verdicts do not accept your result or authorize the next task. Delivery needs explicit scope, and a push can trigger CI or deployment. A workflow checks those effects before publication. A checkpoint records progress; resumption checks the current files and active/uncertain work before repeating anything.

Role instructions do not create separate OS sandboxes, and this package does not guarantee quota/crash recovery, phone approvals, background monitoring, token accounting or deployed health. If native delegation is unavailable, Codex must report the gap rather than silently change the workflow. High reasoning needs prior scoped approval; the default remains Sol / Medium.

## Validate and build the portable package

```sh
npm run test:run
npm run build
```

The tests exercise installation, conflict preservation and package boundaries in temporary directories. They make no model or network calls. The build validates the skills and local links, then copies an explicit file allowlist into `dist/native-codex-workflows/` with a SHA-256 `manifest.json`. That directory is a complete portable copy; its installer works without the original checkout. `dist/` stays out of Git because the source rebuilds it.

Package tests verify the installer and static distribution. They do not certify live Codex behavior on every host. There are no hosted CI or deployment workflows in this repository.

## Files and official guidance

- [Planning skill](skills/project-plan/SKILL.md)
- [Execution skill](skills/project-execute/SKILL.md)
- [Delivery skill](skills/project-deliver/SKILL.md)
- [Optional CLI profile](config/native-workflows.config.toml)

Discovery/install paths follow the [official OpenAI skills documentation](https://learn.chatgpt.com/docs/build-skills). See [configuration basics](https://learn.chatgpt.com/docs/config-file/config-basic) for profile precedence, and [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) for native delegation and inherited permissions. Check current official guidance if your client behaves differently.
