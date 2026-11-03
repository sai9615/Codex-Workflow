import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { skillNames } from './package-files.mjs';
import { isMain, listRegularFiles, sourceRoot, validatePackage } from './validate.mjs';

const help = `Usage:
  node scripts/install.mjs --user [--with-profile] [--dry-run]
  node scripts/install.mjs --project PATH [--dry-run]

Copies the three skills into ~/.agents/skills or PATH/.agents/skills.
--with-profile also copies the optional native-workflows profile into ~/.codex.
Identical installations are skipped. Conflicting files and symlinks are refused.
No existing files are overwritten; no config.toml, credentials or project records change.`;

async function statIfExists(target) {
  try { return await lstat(target); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function assertDirectoryOrAbsent(target) {
  const stat = await statIfExists(target);
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error(`Expected a real directory, not a symlink: ${target}`);
}

async function identicalDirectory(source, destination) {
  const sourceFiles = await listRegularFiles(source);
  const destinationFiles = await listRegularFiles(destination);
  if (JSON.stringify(sourceFiles) !== JSON.stringify(destinationFiles)) return false;
  for (const name of sourceFiles) {
    if (!(await readFile(path.join(source, name))).equals(await readFile(path.join(destination, name)))) return false;
  }
  return true;
}

export async function installWorkflows({ scope, projectDirectory, withProfile = false, dryRun = false, homeDirectory = homedir(), packageRoot = sourceRoot }) {
  if (!['user', 'project'].includes(scope)) throw new Error('Choose exactly one installation scope.');
  if (scope === 'project' && (!projectDirectory || withProfile)) throw new Error('Project scope requires a path and does not install a user profile.');
  await validatePackage(packageRoot);
  const base = await realpath(scope === 'user' ? homeDirectory : projectDirectory);
  const agentDirectory = path.join(base, '.agents');
  const destination = path.join(agentDirectory, 'skills');
  await assertDirectoryOrAbsent(agentDirectory);
  await assertDirectoryOrAbsent(destination);
  const plans = [];
  for (const name of skillNames) {
    const source = path.join(packageRoot, 'skills', name);
    const target = path.join(destination, name);
    const existing = await statIfExists(target);
    if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) throw new Error(`Refusing conflicting target: ${target}`);
    if (existing && !await identicalDirectory(source, target)) throw new Error(`Existing skill differs: ${target}. Back it up and review before replacing it.`);
    plans.push({ kind: 'directory', source, target, action: existing ? 'unchanged' : 'create' });
  }
  if (withProfile) {
    const directory = path.join(base, '.codex');
    await assertDirectoryOrAbsent(directory);
    const source = path.join(packageRoot, 'config', 'native-workflows.config.toml');
    const target = path.join(directory, 'native-workflows.config.toml');
    const existing = await statIfExists(target);
    if (existing && (!existing.isFile() || existing.isSymbolicLink() || !(await readFile(source)).equals(await readFile(target)))) {
      throw new Error(`Existing profile differs or is not a regular file: ${target}`);
    }
    plans.push({ kind: 'file', source, target, action: existing ? 'unchanged' : 'create' });
  }
  // Complete all conflict checks before creating any destination directory.
  if (!dryRun) {
    for (const plan of plans) {
      if (plan.action === 'unchanged') continue;
      await mkdir(path.dirname(plan.target), { recursive: true });
      if (plan.kind === 'directory') {
        await mkdir(plan.target); // exclusive: do not merge into an unexpected directory
        for (const name of await listRegularFiles(plan.source)) {
          const target = path.join(plan.target, name);
          await mkdir(path.dirname(target), { recursive: true });
          await copyFile(path.join(plan.source, name), target, constants.COPYFILE_EXCL);
        }
      } else await copyFile(plan.source, plan.target, constants.COPYFILE_EXCL);
    }
  }
  return { dryRun, plans: plans.map(({ target, action }) => ({ target, action })) };
}

export function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument === '--user') {
      if (options.scope) throw new Error('Choose exactly one installation scope.');
      options.scope = 'user';
    } else if (argument === '--project') {
      if (options.scope) throw new Error('Choose exactly one installation scope.');
      const next = args[++index];
      if (!next || next.startsWith('--')) throw new Error('--project requires an existing project directory.');
      options.scope = 'project'; options.projectDirectory = path.resolve(next);
    } else if (argument === '--with-profile') options.withProfile = true;
    else if (argument === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.scope) throw new Error('Choose --user or --project PATH.');
  return options;
}

if (await isMain(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(help);
    else console.log(JSON.stringify(await installWorkflows(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
