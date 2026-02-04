#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const process = require('node:process');
const { PNG } = require('pngjs');

const DEFAULT_API_URL = process.env.SVG_SYNC_API_URL || 'http://localhost:3000/api/svg';
const SUPPORTED_EXTENSIONS = new Set(['.svg', '.png', '.json']);

function printUsage() {
  console.log('Bruk: node scripts/sync-svg-archive.js --dir=<mappe> [--url=<API-url>] [--dry-run]');
  console.log('');
  console.log('Synkroniserer eksporterte SVG-er (SVG, PNG og metadata-JSON) til /api/svg.');
  console.log('  --dir        Rotmappe som inneholder eksporterte filer.');
  console.log('  --url        Basis-URL til API-et (standard: ' + DEFAULT_API_URL + ').');
  console.log('  --dry-run    Viser hva som ville blitt gjort uten å sende til API-et.');
}

function parseArgs(argv) {
  const result = {
    dir: null,
    url: DEFAULT_API_URL,
    dryRun: false,
    help: false
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (arg.startsWith('--dir=')) {
      const value = arg.slice('--dir='.length).trim();
      if (value) {
        result.dir = value;
      }
      continue;
    }
    if (arg.startsWith('--url=')) {
      const value = arg.slice('--url='.length).trim();
      if (value) {
        result.url = value;
      }
      continue;
    }
  }

  return result;
}

function normalizeSlug(relPath) {
  if (typeof relPath !== 'string') return null;
  const trimmed = relPath.trim();
  if (!trimmed) return null;
  const withoutExt = trimmed.replace(/\.[^/.]+$/, '');
  const normalized = withoutExt.split(path.sep).filter(Boolean).join('/');
  return normalized || null;
}

async function walkFiles(rootDir) {
  const stack = [rootDir];
  const discovered = new Map();

  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        continue;
      }
      const relPath = path.relative(rootDir, entryPath);
      const slug = normalizeSlug(relPath);
      if (!slug) {
        continue;
      }
      const record = discovered.get(slug) || { slug, files: {} };
      record.files[ext] = entryPath;
      discovered.set(slug, record);
    }
  }

  return Array.from(discovered.values());
}

async function readSvg(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data;
  } catch (error) {
    throw new Error(`Kunne ikke lese SVG-fil ${filePath}: ${error.message}`);
  }
}

async function readPng(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    let width;
    let height;
    try {
      const parsed = PNG.sync.read(buffer);
      width = parsed.width;
      height = parsed.height;
    } catch (error) {
      width = undefined;
      height = undefined;
    }
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    return { dataUrl, width, height };
  } catch (error) {
    throw new Error(`Kunne ikke lese PNG-fil ${filePath}: ${error.message}`);
  }
}

async function readMetadata(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    if (!text.trim()) {
      return {};
    }
    const data = JSON.parse(text);
    if (data && typeof data === 'object') {
      return data;
    }
    return {};
  } catch (error) {
    console.warn(`⚠️  Klarte ikke å lese metadata fra ${filePath}: ${error.message}`);
    return {};
  }
}

function sanitizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildPayload({ slug, svg, png, metadata }) {
  const baseName = slug.split('/').filter(Boolean).pop() || 'export';
  const createdAt = sanitizeString(metadata.createdAt) || new Date().toISOString();
  const toolId = sanitizeString(metadata.toolId || metadata.tool);
  const altText =
    metadata.altText !== undefined
      ? metadata.altText
      : metadata.alt !== undefined
      ? metadata.alt
      : undefined;

  const payload = {
    slug,
    title: sanitizeString(metadata.title || metadata.description || baseName) || baseName,
    tool: toolId || 'ukjent',
    toolId: toolId || undefined,
    baseName,
    filename: `${baseName}.svg`,
    svg,
    png: png.dataUrl,
    createdAt
  };

  if (png.width != null) {
    payload.pngWidth = png.width;
  }
  if (png.height != null) {
    payload.pngHeight = png.height;
  }

  if (metadata.summary !== undefined) {
    payload.summary = metadata.summary;
  }
  if (metadata.description !== undefined) {
    payload.description = metadata.description;
  }
  if (altText !== undefined) {
    payload.altText = altText;
  }
  if (metadata.exampleState !== undefined) {
    payload.exampleState = metadata.exampleState;
  }

  const reserved = new Set([
    'slug',
    'title',
    'tool',
    'toolId',
    'baseName',
    'filename',
    'svg',
    'png',
    'createdAt',
    'summary',
    'description',
    'altText',
    'alt',
    'exampleState'
  ]);

  if (metadata && typeof metadata === 'object') {
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined) continue;
      if (reserved.has(key)) continue;
      if (payload[key] !== undefined) continue;
      payload[key] = value;
    }
  }

  return payload;
}

async function prepareEntries(rootDir) {
  const discovered = await walkFiles(rootDir);
  const prepared = [];

  for (const entry of discovered) {
    const { slug, files } = entry;
    if (!files['.svg'] || !files['.png']) {
      continue;
    }
    const svgPath = files['.svg'];
    const pngPath = files['.png'];
    const jsonPath = files['.json'];

    const [svg, png, metadata] = await Promise.all([
      readSvg(svgPath),
      readPng(pngPath),
      jsonPath ? readMetadata(jsonPath) : Promise.resolve({})
    ]);

    prepared.push({ slug, payload: buildPayload({ slug, svg, png, metadata }), files });
  }

  return prepared;
}

function resolveTargetUrl(baseUrl) {
  const candidate = baseUrl || DEFAULT_API_URL;
  try {
    return new URL(candidate).toString();
  } catch (error) {
    throw new Error(`Ugyldig API-URL: ${candidate}`);
  }
}

async function syncEntry(url, payload) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    const message = data && data.error ? data.error : `Status ${response.status}`;
    throw new Error(`API-feil (${payload.slug}): ${message}`);
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.dir) {
    printUsage();
    if (!args.dir) {
      process.exitCode = 1;
    }
    return;
  }

  const rootDir = path.resolve(process.cwd(), args.dir);
  let stats;
  try {
    stats = await fs.stat(rootDir);
  } catch (error) {
    console.error(`Fant ikke katalogen: ${rootDir}`);
    process.exitCode = 1;
    return;
  }
  if (!stats.isDirectory()) {
    console.error(`Stien er ikke en katalog: ${rootDir}`);
    process.exitCode = 1;
    return;
  }

  const entries = await prepareEntries(rootDir);
  if (!entries.length) {
    console.log('Ingen SVG-eksporter funnet i mappen.');
    return;
  }

  let targetUrl;
  try {
    targetUrl = resolveTargetUrl(args.url || DEFAULT_API_URL);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  for (const entry of entries) {
    if (args.dryRun) {
      console.log(`Dry-run: ville synkronisert ${entry.slug}`);
      continue;
    }
    try {
      await syncEntry(targetUrl, entry.payload);
      console.log(`✅ Synkroniserte ${entry.slug}`);
    } catch (error) {
      console.error(`❌ Feil ved synkronisering av ${entry.slug}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  normalizeSlug,
  walkFiles,
  prepareEntries,
  buildPayload
};
