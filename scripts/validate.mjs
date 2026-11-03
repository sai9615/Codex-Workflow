import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageFiles, skillNames } from './package-files.mjs';

export const sourceRoot = fileURLToPath(new URL('../', import.meta.url));

export async function isMain(moduleUrl) {
  return Boolean(process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(moduleUrl));
}

export async function listRegularFiles(directory, prefix = '') {
  const result = [];
  const rootStat = await lstat(directory);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`Expected a regular directory: ${directory}`);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not packaged: ${relative}`);
    if (entry.isDirectory()) result.push(...await listRegularFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
    else throw new Error(`Unsupported file type: ${relative}`);
  }
  return result.sort();
}

export async function validatePackage(root = sourceRoot) {
  for (const name of packageFiles) {
    const parts = name.split('/');
    for (let count = 1; count < parts.length; count += 1) {
      const parent = await lstat(path.join(root, ...parts.slice(0, count)));
      if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error(`Package parent must not be a symlink: ${name}`);
    }
    const stat = await lstat(path.join(root, name));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected regular package file: ${name}`);
    const body = await readFile(path.join(root, name), 'utf8');
    if (/\/Users\/[a-z][a-z0-9_-]*\//i.test(body) || /[A-Z]:\\Users\\/i.test(body)) {
      throw new Error(`Machine-specific user path in ${name}`);
    }
    if (name.endsWith('.md')) {
      const prose = body.replace(/```[\s\S]*?```/g, '');
      for (const match of prose.matchAll(/\[[^\]\n]+\]\(([^)]+)\)/g)) {
        const target = match[1].replace(/^<|>$/g, '').split('#')[0];
        if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
        const absolute = path.resolve(path.dirname(path.join(root, name)), decodeURIComponent(target));
        const relative = path.relative(root, absolute).split(path.sep).join('/');
        if (!packageFiles.includes(relative)) throw new Error(`Link leaves distribution: ${name} -> ${target}`);
      }
    }
  }
  for (const name of skillNames) {
    const body = await readFile(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const frontmatter = body.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/);
    const metadata = frontmatter?.[1].replace(/\r\n/g, '\n');
    if (!metadata || !metadata.includes(`name: ${name}\n`) || !/^description: .+/m.test(metadata)) {
      throw new Error(`Invalid skill metadata: ${name}`);
    }
    const actual = await listRegularFiles(path.join(root, 'skills', name));
    const expected = packageFiles.filter(p => p.startsWith(`skills/${name}/`)).map(p => p.slice(`skills/${name}/`.length)).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Unexpected files in skill ${name}`);
  }
  return { packageFiles: packageFiles.length, skills: skillNames.length };
}

if (await isMain(import.meta.url)) {
  validatePackage().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
