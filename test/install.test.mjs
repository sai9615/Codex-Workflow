import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installWorkflows, parseArgs } from '../scripts/install.mjs';
import { sourceRoot } from '../scripts/validate.mjs';
import { skillNames } from '../scripts/package-files.mjs';

async function temporary(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'native-workflows-install-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
async function absent(target) {
  await assert.rejects(access(target), { code: 'ENOENT' });
}

test('dry run plans all user skills/profile without creating destination files', async t => {
  const directory = await temporary(t);
  const result = await installWorkflows({ scope: 'user', homeDirectory: directory, withProfile: true, dryRun: true });
  assert.equal(result.plans.length, 4);
  assert.ok(result.plans.every(p => p.action === 'create'));
  await absent(path.join(directory, '.agents'));
  await absent(path.join(directory, '.codex'));
});

test('user installation preserves config and unrelated skills and is idempotent', async t => {
  const directory = await temporary(t);
  await mkdir(path.join(directory, '.codex'));
  await writeFile(path.join(directory, '.codex/config.toml'), '# existing user settings\n');
  await mkdir(path.join(directory, '.agents/skills/unrelated'), { recursive: true });
  await writeFile(path.join(directory, '.agents/skills/unrelated/SKILL.md'), 'private skill\n');
  const options = { scope: 'user', homeDirectory: directory, withProfile: true };
  await installWorkflows(options);
  for (const name of skillNames) {
    assert.deepEqual(await readFile(path.join(directory, '.agents/skills', name, 'SKILL.md')), await readFile(path.join(sourceRoot, 'skills', name, 'SKILL.md')));
  }
  assert.equal(await readFile(path.join(directory, '.codex/config.toml'), 'utf8'), '# existing user settings\n');
  assert.equal(await readFile(path.join(directory, '.agents/skills/unrelated/SKILL.md'), 'utf8'), 'private skill\n');
  assert.ok((await installWorkflows(options)).plans.every(p => p.action === 'unchanged'));
});

test('one late skill conflict prevents all other new writes', async t => {
  const directory = await temporary(t);
  const conflict = path.join(directory, '.agents/skills/project-deliver');
  await mkdir(conflict, { recursive: true });
  await writeFile(path.join(conflict, 'SKILL.md'), 'preserve this local version\n');
  await assert.rejects(installWorkflows({ scope: 'user', homeDirectory: directory, withProfile: true }), /Existing skill differs/);
  assert.equal(await readFile(path.join(conflict, 'SKILL.md'), 'utf8'), 'preserve this local version\n');
  await absent(path.join(directory, '.agents/skills/project-plan'));
  await absent(path.join(directory, '.codex'));
});

test('profile conflict prevents skill installation and preserves profile', async t => {
  const directory = await temporary(t);
  await mkdir(path.join(directory, '.codex'));
  await writeFile(path.join(directory, '.codex/native-workflows.config.toml'), '# custom profile\n');
  await assert.rejects(installWorkflows({ scope: 'user', homeDirectory: directory, withProfile: true }), /Existing profile differs/);
  await absent(path.join(directory, '.agents'));
  assert.equal(await readFile(path.join(directory, '.codex/native-workflows.config.toml'), 'utf8'), '# custom profile\n');
});

test('project install is scoped, leaves project instructions untouched and never adds a profile', async t => {
  const directory = await temporary(t);
  await writeFile(path.join(directory, 'AGENTS.md'), 'existing project rules\n');
  await installWorkflows({ scope: 'project', projectDirectory: directory });
  assert.equal(await readFile(path.join(directory, 'AGENTS.md'), 'utf8'), 'existing project rules\n');
  await absent(path.join(directory, '.codex'));
  await assert.rejects(installWorkflows({ scope: 'project', projectDirectory: directory, withProfile: true }), /does not install a user profile/);
});

test('installer refuses symlinked destination roots and existing skill targets', async t => {
  if (process.platform === 'win32') return t.skip('Symlink creation needs host privileges; checked on macOS/Linux.');
  const directory = await temporary(t);
  const outside = path.join(directory, 'outside');
  const project = path.join(directory, 'project');
  await mkdir(outside); await mkdir(project);
  await symlink(outside, path.join(project, '.agents'), 'dir');
  await assert.rejects(installWorkflows({ scope: 'project', projectDirectory: project }), /real directory/);
  await absent(path.join(outside, 'skills'));
  await rm(path.join(project, '.agents'));
  await mkdir(path.join(project, '.agents/skills'), { recursive: true });
  await symlink(outside, path.join(project, '.agents/skills/project-plan'), 'dir');
  await assert.rejects(installWorkflows({ scope: 'project', projectDirectory: project }), /conflicting target/);
  await absent(path.join(outside, 'SKILL.md'));
});

test('CLI rejects ambiguous/missing scope and project arguments', () => {
  for (const args of [[], ['--user', '--project', '.'], ['--project'], ['--project', '--dry-run'], ['--unknown']]) {
    assert.throws(() => parseArgs(args));
  }
  assert.deepEqual(parseArgs(['--user', '--dry-run']), { scope: 'user', dryRun: true });
});

test('documented project CLI installs and dry-run leaves project unchanged', async t => {
  const directory = await temporary(t);
  const script = path.join(sourceRoot, 'scripts/install.mjs');
  const preview = spawnSync(process.execPath, [script, '--project', directory, '--dry-run'], { encoding: 'utf8' });
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).dryRun, true);
  await absent(path.join(directory, '.agents'));
  const actual = spawnSync(process.execPath, [script, '--project', directory], { encoding: 'utf8' });
  assert.equal(actual.status, 0, actual.stderr);
  assert.equal(JSON.parse(actual.stdout).plans.length, 3);
  assert.match(await readFile(path.join(directory, '.agents/skills/project-plan/SKILL.md'), 'utf8'), /^---\n/);
});
