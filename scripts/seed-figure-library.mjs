#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire, register } from 'node:module';

register(new URL('./helpers/force-esm-loader.mjs', import.meta.url));

const require = createRequire(import.meta.url);
const {
  ensureCategory,
  setFigure
} = require('../api/_lib/figure-library-store.js');

const { buildFigureData } = await import('../figure-library/all.js');
const { measurementFigureManifest } = await import('../packages/figures/src/index.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function printUsage() {
  console.log('Bruk: node scripts/seed-figure-library.mjs [--dry-run] [--help]');
  console.log('');
  console.log('Leser manifestdata fra figure-library/all.js og fyller figurbibliotek-lagringen.');
  console.log('  --dry-run   Viser hva som ville blitt skrevet uten å endre lagringen.');
  console.log('  --help      Viser denne hjelpeteksten.');
}

function parseArgs(argv) {
  const options = { dryRun: false, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
  }
  return options;
}

function sanitizeCategoryPayload(category, measurementMeta) {
  const payload = {
    id: category.id,
    label: category.label || category.id
  };
  if (category.type) {
    payload.type = category.type;
  } else if (measurementMeta) {
    payload.type = 'measurement';
  }
  if (Array.isArray(category.apps) && category.apps.length) {
    payload.apps = category.apps.slice();
  } else if (measurementMeta && Array.isArray(measurementMeta.apps) && measurementMeta.apps.length) {
    payload.apps = measurementMeta.apps.slice();
  }
  if (category.description) {
    payload.description = category.description;
  }
  return payload;
}

function buildMeasurementCategoryIndex() {
  const index = new Map();
  if (!measurementFigureManifest || !Array.isArray(measurementFigureManifest.categories)) {
    return index;
  }
  for (const category of measurementFigureManifest.categories) {
    if (!category || typeof category !== 'object') continue;
    if (!category.id) continue;
    index.set(category.id, category);
  }
  return index;
}

function resolveAssetPath(imagePath) {
  if (typeof imagePath !== 'string') {
    return null;
  }
  const trimmed = imagePath.trim();
  if (!trimmed) {
    return null;
  }
  const withoutQuery = trimmed.split('?')[0];
  const withoutOrigin = withoutQuery.replace(/^https?:\/\//i, '');
  const withoutLeadingSlash = withoutOrigin.replace(/^\/+/, '');
  const decoded = decodeURIComponent(withoutLeadingSlash);
  const segments = decoded.split(/[\\/]+/).filter(Boolean);
  if (!segments.length) {
    return null;
  }
  return path.join(ROOT_DIR, ...segments);
}

async function loadSvgMarkup(imagePath) {
  const assetPath = resolveAssetPath(imagePath);
  if (!assetPath) {
    return null;
  }
  try {
    return await readFile(assetPath, 'utf8');
  } catch (error) {
    console.warn(`⚠️  Fant ikke SVG for ${imagePath}: ${error && error.message ? error.message : error}`);
    return null;
  }
}

async function loadPngDataUrl(imagePath) {
  const assetPath = resolveAssetPath(imagePath);
  if (!assetPath) {
    return null;
  }
  const pngCandidate = assetPath.replace(/\.svg$/i, '.png');
  if (pngCandidate === assetPath) {
    return null;
  }
  try {
    const buffer = await readFile(pngCandidate);
    if (!buffer.length) {
      return null;
    }
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn(`⚠️  Kunne ikke lese PNG for ${imagePath}: ${error.message || error}`);
    }
    return null;
  }
}

function buildPlaceholderSvg(name, categoryLabel) {
  const title = name || 'Figur';
  const categoryText = categoryLabel ? ` (${categoryLabel})` : '';
  const label = `${title}${categoryText}`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 160" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f4f6f8" />
      <stop offset="100%" stop-color="#e8ebee" />
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="258" height="158" rx="10" ry="10" fill="url(#bg)" stroke="#c5ccd3" stroke-width="2" />
  <path d="M20 120 Q 130 40 240 120" fill="none" stroke="#d1d8df" stroke-width="3" stroke-linecap="round" />
  <circle cx="60" cy="90" r="8" fill="#7fb1e3" />
  <circle cx="140" cy="70" r="8" fill="#7fb1e3" />
  <circle cx="210" cy="100" r="8" fill="#7fb1e3" />
  <text x="130" y="128" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#4a5560">${title}</text>
  ${categoryLabel ? `<text x="130" y="148" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">${categoryLabel}</text>` : ''}
</svg>
`.trim();
}

async function seedFigures({ dryRun }) {
  const measurementIndex = buildMeasurementCategoryIndex();
  const data = buildFigureData();
  const categories = Array.isArray(data.categories) ? data.categories : [];

  if (!categories.length) {
    console.log('Fant ingen kategorier i manifestdata.');
    return { categories: { ensured: 0 }, figures: { seeded: 0, skipped: 0 } };
  }

  let categoriesEnsured = 0;
  let figureSeeded = 0;
  let figureSkipped = 0;

  for (const category of categories) {
    if (!category || !category.id) {
      continue;
    }
    const measurementMeta = measurementIndex.get(category.id);
    const payload = sanitizeCategoryPayload(category, measurementMeta);
    console.log(`${dryRun ? '[tørrkjøring] ' : ''}Sikrer kategori ${payload.id} (${payload.label})`);
    if (!dryRun) {
      try {
        await ensureCategory(payload);
      } catch (error) {
        console.error(`❌  Kunne ikke sikre kategori ${payload.id}: ${error && error.message ? error.message : error}`);
        continue;
      }
    }
    categoriesEnsured += 1;

    const figures = Array.isArray(category.figures) ? category.figures : [];
    for (const figure of figures) {
      if (!figure) {
        continue;
      }
      const slug = figure.slug || figure.id;
      if (!slug) {
        console.warn('⚠️  Hopper over figur uten slug');
        figureSkipped += 1;
        continue;
      }
      const isCustomFigure = !!figure.custom || payload.id === 'custom';
      const categoryLabel = payload.label || category.label || category.id;
      const svgMarkup = await loadSvgMarkup(figure.image || figure.fileName);
      let resolvedSvgMarkup = svgMarkup;
      if (!resolvedSvgMarkup && isCustomFigure) {
        resolvedSvgMarkup = buildPlaceholderSvg(figure.name || slug || 'Egendefinert figur', categoryLabel);
      }
      if (!resolvedSvgMarkup) {
        console.warn(`⚠️  Fant ikke SVG-data for ${slug} – bruker plassholder.`);
        resolvedSvgMarkup = buildPlaceholderSvg(figure.name || slug, categoryLabel);
      }
      const pngData = await loadPngDataUrl(figure.image || figure.fileName);
      const summary = figure.summary || figure.dimensions || '';
      const figurePayload = {
        slug,
        name: figure.name || slug,
        title: figure.name || slug,
        summary,
        svg: resolvedSvgMarkup,
        category: {
          id: payload.id,
          label: categoryLabel,
          apps: payload.apps ? payload.apps.slice() : undefined
        }
      };
      if (pngData) {
        figurePayload.png = pngData;
      }
      console.log(`${dryRun ? '[tørrkjøring] ' : ''}Lagrer figur ${slug}`);
      if (!dryRun) {
        try {
          await setFigure(slug, figurePayload);
          figureSeeded += 1;
        } catch (error) {
          console.error(`❌  Kunne ikke lagre ${slug}: ${error && error.message ? error.message : error}`);
          figureSkipped += 1;
        }
      } else {
        figureSeeded += 1;
      }
    }
  }

  return {
    categories: { ensured: categoriesEnsured },
    figures: { seeded: figureSeeded, skipped: figureSkipped }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  try {
    const result = await seedFigures(options);
    if (options.dryRun) {
      console.log(`Tørrkjøring ferdig – ${result.categories.ensured} kategorier og ${result.figures.seeded} figurer ville blitt skrevet (${result.figures.skipped} hoppet over).`);
    } else {
      console.log(`Ferdig – ${result.categories.ensured} kategorier sikret, ${result.figures.seeded} figurer lagret, ${result.figures.skipped} hoppet over.`);
    }
  } catch (error) {
    console.error('Utskrivingen feilet:', error);
    process.exitCode = 1;
  }
}

export {
  parseArgs,
  sanitizeCategoryPayload,
  buildMeasurementCategoryIndex,
  resolveAssetPath,
  loadSvgMarkup,
  loadPngDataUrl,
  seedFigures,
  main
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
