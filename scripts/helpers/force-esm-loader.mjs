import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

function isInside(targetDir, filePath) {
  const relative = path.relative(targetDir, filePath);
  if (!relative) {
    return true;
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function shouldForceEsm(filePath) {
  const normalized = path.normalize(filePath);
  const targets = [
    path.join(ROOT_DIR, 'figure-library'),
    path.join(ROOT_DIR, 'images', 'amounts'),
    path.join(ROOT_DIR, 'images', 'measure')
  ];
  return targets.some(dir => isInside(dir, normalized));
}

export async function load(url, context, defaultLoad) {
  if (url.startsWith('file://')) {
    const filePath = fileURLToPath(url);
    if (shouldForceEsm(filePath)) {
      const source = await readFile(filePath, 'utf8');
      return { format: 'module', source, shortCircuit: true };
    }
  }
  return defaultLoad(url, context, defaultLoad);
}
