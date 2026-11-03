import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { packageFiles } from './package-files.mjs';
import { isMain, sourceRoot, validatePackage } from './validate.mjs';

export async function buildPackage(root = sourceRoot) {
  await validatePackage(root);
  const directory = path.join(root, 'dist');
  const output = path.join(directory, 'native-codex-workflows');
  for (const target of [directory, output]) {
    try { const stat = await lstat(target); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Refusing non-directory build path: ${target}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(directory, { recursive: true });
  const staging = await mkdtemp(path.join(directory, '.build-'));
  try {
    const manifest = {};
    for (const name of packageFiles) {
      const target = path.join(staging, name);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(root, name), target, constants.COPYFILE_EXCL);
      manifest[name] = createHash('sha256').update(await readFile(target)).digest('hex');
    }
    await writeFile(path.join(staging, 'manifest.json'), JSON.stringify({ format: 1, files: manifest }, null, 2) + '\n', { flag: 'wx' });
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    return { output, files: packageFiles.length, manifest: 'manifest.json' };
  } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
}

if (await isMain(import.meta.url)) {
  buildPackage().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
