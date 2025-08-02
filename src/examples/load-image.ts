import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function findPackageRoot(startDir: string): string {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error('package.json not found');
}

export function loadSampleImage() {
  const currentFile = fileURLToPath(import.meta.url);
  const packageRoot = findPackageRoot(path.dirname(currentFile));
  const rawPath = path.join(packageRoot, 'data', 'DSC00053.ARW');

  if (!fs.existsSync(rawPath)) {
    throw new Error(`${rawPath} not found in project root`);
  }

  return fs.readFileSync(rawPath);
}
