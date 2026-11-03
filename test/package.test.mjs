import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { packageFiles } from '../scripts/package-files.mjs';
import { sourceRoot, listRegularFiles, validatePackage } from '../scripts/validate.mjs';
import { buildPackage } from '../scripts/build.mjs';

async function packageCopy(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'native-workflows-package-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const name of packageFiles) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(sourceRoot, name), target);
  }
  return directory;
}

test('source distribution validates skill metadata, references and portable paths', async () => {
  assert.deepEqual(await validatePackage(), { packageFiles: packageFiles.length, skills: 3 });
});

test('build includes only allowlisted files, correct hashes and no local tracking material', async t => {
  const directory = await packageCopy(t);
  const trackingSentinel = `private-tracking-${randomUUID()}`;
  const environmentSentinel = `private-env-${randomUUID()}`;
  await mkdir(path.join(directory, 'workflow-notes'));
  await writeFile(path.join(directory, 'workflow-notes/private-note.md'), trackingSentinel);
  await writeFile(path.join(directory, '.env'), environmentSentinel);
  const built = await buildPackage(directory);
  assert.deepEqual(await listRegularFiles(built.output), [...packageFiles, 'manifest.json'].sort());
  const manifest = JSON.parse(await readFile(path.join(built.output, 'manifest.json'), 'utf8'));
  assert.equal(manifest.format, 1);
  for (const name of packageFiles) {
    const content = await readFile(path.join(built.output, name));
    assert.equal(createHash('sha256').update(content).digest('hex'), manifest.files[name]);
    assert.ok(!content.includes(Buffer.from(trackingSentinel)));
    assert.ok(!content.includes(Buffer.from(environmentSentinel)));
  }
});

test('built copy installs without the source checkout', async t => {
  const directory = await packageCopy(t);
  const built = await buildPackage(directory);
  for (const name of packageFiles) await rm(path.join(directory, name));
  const project = path.join(directory, 'target-project');
  await mkdir(project);
  const run = spawnSync(process.execPath, [path.join(built.output, 'scripts/install.mjs'), '--project', project], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).plans.length, 3);
  assert.equal(await readFile(path.join(project, '.agents/skills/project-plan/SKILL.md'), 'utf8'), await readFile(path.join(built.output, 'skills/project-plan/SKILL.md'), 'utf8'));
});

test('missing relative reference stops validation before distribution', async t => {
  const directory = await packageCopy(t);
  const target = path.join(directory, 'skills/project-plan/SKILL.md');
  await writeFile(target, (await readFile(target, 'utf8')) + '\n[Broken](references/missing.md)\n');
  await assert.rejects(validatePackage(directory), /Link leaves distribution/);
});

test('unexpected skill files cannot leak into an installation', async t => {
  const directory = await packageCopy(t);
  await writeFile(path.join(directory, 'skills/project-plan/private-notes.md'), 'PRIVATE_NOTES');
  await assert.rejects(validatePackage(directory), /Unexpected files in skill/);
});

test('symlinked build output is refused without touching its target', async t => {
  if (process.platform === 'win32') return t.skip('Symlink creation needs host privileges; checked on macOS/Linux.');
  const directory = await packageCopy(t);
  const outside = path.join(directory, 'outside');
  await mkdir(outside); await writeFile(path.join(outside, 'keep.txt'), 'preserve');
  await symlink(outside, path.join(directory, 'dist'), 'dir');
  await assert.rejects(buildPackage(directory), /Refusing non-directory build path/);
  assert.equal(await readFile(path.join(outside, 'keep.txt'), 'utf8'), 'preserve');
});
