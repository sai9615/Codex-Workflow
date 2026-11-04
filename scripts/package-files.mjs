export const skillNames = ['project-plan', 'project-execute', 'project-deliver'];

// Explicit distribution boundary: never collect the surrounding workspace/vault.
export const packageFiles = [
  '.gitignore', 'AGENTS.md', 'README.md', 'package.json',
  'config/native-workflows.config.toml',
  'scripts/package-files.mjs', 'scripts/validate.mjs',
  'scripts/install.mjs', 'scripts/build.mjs',
  'test/install.test.mjs', 'test/package.test.mjs',
  'skills/project-plan/SKILL.md',
  'skills/project-plan/references/project-records.md',
  'skills/project-plan/references/documentation-contract.md',
  'skills/project-execute/SKILL.md',
  'skills/project-execute/references/task-report.md',
  'skills/project-execute/references/efficiency-validation.md',
  'skills/project-deliver/SKILL.md',
  'skills/project-deliver/references/delivery-record.md',
];
