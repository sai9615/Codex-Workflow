export const skillNames = ['project-plan', 'project-execute', 'project-deliver'];

// Explicit distribution boundary: never collect the surrounding workspace/vault.
export const packageFiles = [
  '.gitignore', 'AGENTS.md', 'README.md', 'package.json',
  'config/native-workflows.config.toml',
  'config/deepseek-worker.example.config.toml',
  'config/deepseek-request.example.json', 'config/deepseek-approval.example.json',
  'scripts/package-files.mjs', 'scripts/validate.mjs',
  'scripts/install.mjs', 'scripts/build.mjs', 'scripts/deepseek-worker.mjs',
  'scripts/journal-aggregate.mjs', 'scripts/context-check.mjs', 'scripts/worker-result-check.mjs',
  'scripts/worker-budget.mjs', 'scripts/envelope-check.mjs',
  'test/install.test.mjs', 'test/package.test.mjs', 'test/deepseek-worker.test.mjs',
  'test/journal-aggregate.test.mjs', 'test/context-check.test.mjs', 'test/worker-result-check.test.mjs',
  'test/worker-budget.test.mjs', 'test/envelope-check.test.mjs', 'test/review-regressions.test.mjs',
  'skills/project-plan/SKILL.md',
  'skills/project-plan/references/project-records.md',
  'skills/project-plan/references/documentation-contract.md',
  'skills/project-execute/SKILL.md',
  'skills/project-execute/references/task-report.md',
  'skills/project-execute/references/reviewer-package.md',
  'skills/project-execute/references/deepseek-workers.md',
  'skills/project-execute/references/efficiency-validation.md',
  'skills/project-execute/references/execution-context.md',
  'skills/project-execute/references/worker-results.md',
  'skills/project-deliver/SKILL.md',
  'skills/project-deliver/references/delivery-record.md',
];
