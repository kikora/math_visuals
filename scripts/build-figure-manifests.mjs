#!/usr/bin/env node

import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  MEASURE_IMAGE_BASE_PATH,
  createMeasurementFigureLibrary
} from '../packages/figures/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const NB_LOCALE = 'nb';

function sanitizeRelativePath(relativePath) {
  if (typeof relativePath !== 'string') {
    return '';
  }
  const withoutLeadingDot = relativePath.replace(/^\.\//, '');
  const trimmed = withoutLeadingDot.replace(/[\\/]+/g, '/');
  return trimmed.replace(/\/+$/, '');
}

function resolveFromRoot(relativePath) {
  const sanitized = sanitizeRelativePath(relativePath);
  if (!sanitized) {
    return ROOT_DIR;
  }
  const segments = sanitized.split('/').filter(Boolean);
  return path.join(ROOT_DIR, ...segments);
}

async function readExistingMeasurementDescriptions(manifestPath) {
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.categories)) {
      return new Map();
    }
    const descriptions = new Map();
    for (const category of payload.categories) {
      if (!category || typeof category !== 'object') continue;
      const id = typeof category.id === 'string' ? category.id : null;
      if (!id) continue;
      const description = typeof category.description === 'string' ? category.description : '';
      descriptions.set(id, description);
    }
    return descriptions;
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn(`Could not read existing measurement manifest: ${error.message}`);
    }
    return new Map();
  }
}

async function buildMeasurementManifest() {
  const measurementDir = resolveFromRoot(MEASURE_IMAGE_BASE_PATH);
  const manifestPath = path.join(measurementDir, 'manifest.json');
  const existingDescriptions = await readExistingMeasurementDescriptions(manifestPath);

  const categories = createMeasurementFigureLibrary();

  if (!MEASURE_IMAGE_BASE_PATH || !categories.length) {
    console.log('Skipping measurement manifest – no bundled measurement figures.');
    return null;
  }

  const payload = {
    categories: categories.map(category => ({
      id: category.id,
      name: category.label,
      description: existingDescriptions.get(category.id) || '',
      items: category.figures.map(figure => ({
        id: figure.id,
        name: figure.name,
        summary: figure.summary,
        image: figure.image,
        fileName: figure.fileName,
        dimensions: figure.dimensions,
        scaleLabel: figure.scaleLabel
      }))
    }))
  };

  await fs.mkdir(measurementDir, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`);
  return manifestPath;
}

async function buildAmountManifest() {
  const amountDir = resolveFromRoot('images/amounts');
  const manifestPath = path.join(amountDir, 'manifest.json');

  const entries = await fs.readdir(amountDir, { withFileTypes: true });
  const svgFiles = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.svg'))
    .map(entry => entry.name)
    .filter(name => name.toLowerCase() !== 'manifest.svg');

  svgFiles.sort((a, b) => a.localeCompare(b, NB_LOCALE, { numeric: true, sensitivity: 'base' }));

  const payload = {
    files: svgFiles,
    slugs: svgFiles.map(name => name.replace(/\.svg$/i, ''))
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`);
  return manifestPath;
}

async function main() {
  try {
    const measurementPath = await buildMeasurementManifest();
    if (measurementPath) {
      console.log(`Wrote measurement manifest to ${path.relative(ROOT_DIR, measurementPath)}`);
    }

    const amountPath = await buildAmountManifest();
    console.log(`Wrote amount manifest to ${path.relative(ROOT_DIR, amountPath)}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

await main();
