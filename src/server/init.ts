import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function isDirEmpty(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.length === 0;
  } catch {
    return true;
  }
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function initSpecs(targetDir: string): Promise<void> {
  if (await dirExists(targetDir)) {
    const empty = await isDirEmpty(targetDir);
    if (!empty) {
      throw new Error(
        `"${targetDir}" already exists and is not empty.\nSpecify a different directory or remove it manually.`,
      );
    }
  }

  // Resolve examples/specs relative to this compiled module
  // dist/cli/index.js -> ../../examples/specs
  const examplesDir = fileURLToPath(new URL('../../examples/specs', import.meta.url));

  try {
    await fs.access(examplesDir);
  } catch {
    throw new Error(
      `Examples directory not found: ${examplesDir}\n` +
        `Please make sure the package has been built.`,
    );
  }

  await copyDir(examplesDir, targetDir);
}
