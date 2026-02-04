#!/usr/bin/env node
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, extname } from 'node:path';
import { readdir } from 'node:fs/promises';

const CHECK_FLAGS = new Set(['--check', '--verify']);
const args = process.argv.slice(2);
const checkOnly = args.some((arg) => CHECK_FLAGS.has(arg));

const manifestPath = resolve('scripts/vendor-manifest.json');
let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  console.error(`Failed to read vendor manifest at ${manifestPath}`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
  process.exit(1);
}

const outputRoot = resolve(manifest.outputRoot ?? 'vendor/cdn');
const packages = manifest.packages ?? {};

const expectedFiles = new Map(); // destRel -> { src, dest, transform }
const inlineFontPackages = [];

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function collectDirectory(baseDir, relDir) {
  const abs = resolve(baseDir, relDir);
  const entries = await readdir(abs, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryRel = join(relDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectDirectory(baseDir, entryRel));
    } else if (entry.isFile()) {
      files.push(entryRel);
    }
  }
  return files;
}

async function fileHash(path) {
  try {
    const data = await readFile(path);
    const hash = createHash('sha256').update(data).digest('hex');
    return hash;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function addExpectedFiles(pkgName, pkgConfig) {
  const baseDir = resolve(pkgConfig.baseDir);
  const packageOutputRoot = join(outputRoot, pkgName);
  await ensureDir(packageOutputRoot);

  const fileList = Array.isArray(pkgConfig.files) ? [...pkgConfig.files] : [];
  const directories = Array.isArray(pkgConfig.directories) ? pkgConfig.directories : [];
  const inlineFonts = pkgConfig.inlineFonts;
  const inlineTarget = inlineFonts && inlineFonts.targetCss;

  for (const dirRel of directories) {
    const collected = await collectDirectory(baseDir, dirRel);
    fileList.push(...collected);
  }

  for (const relPath of fileList) {
    const src = resolve(baseDir, relPath);
    const destRel = join(pkgName, relPath);
    const dest = join(outputRoot, destRel);
    const transform = inlineTarget === relPath ? 'inline-fonts' : undefined;
    expectedFiles.set(destRel.replace(/\\/g, '/'), { src, dest, transform });
  }

  if (inlineFonts && inlineFonts.directory && inlineFonts.targetCss) {
    inlineFontPackages.push({
      pkgName,
      baseDir,
      fontDirRel: inlineFonts.directory,
      targetCssRel: inlineFonts.targetCss,
    });
  }
}

for (const [pkgName, pkgConfig] of Object.entries(packages)) {
  await addExpectedFiles(pkgName, pkgConfig);
}

const operations = [];
const problems = [];

for (const [destRel, info] of expectedFiles.entries()) {
  operations.push((async () => {
    if (info.transform === 'inline-fonts') {
      return;
    }
    const { src, dest } = info;
    const destDir = dirname(dest);
    await ensureDir(destDir);
    const [srcHash, destHash] = await Promise.all([fileHash(src), fileHash(dest)]);
    if (srcHash == null) {
      problems.push(`Source missing: ${src}`);
      return;
    }
    if (destHash !== srcHash) {
      if (checkOnly) {
        problems.push(`Out of date: ${destRel}`);
      } else {
        await copyFile(src, dest);
      }
    }
  })());
}

await Promise.all(operations);

const FONT_MIME_TYPES = new Map([
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
]);

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeFontDir(fontDir) {
  const normalized = fontDir.replace(/\\/g, '/');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

async function buildInlinedCss({ baseDir, fontDirRel, targetCssRel }) {
  const cssSource = resolve(baseDir, targetCssRel);
  const originalCss = await readFile(cssSource, 'utf8');
  const fontDirPrefix = normalizeFontDir(fontDirRel);
  const fontUrlPattern = /url\(([^)]+)\)/g;
  const fontDataCache = new Map();

  const matches = [...originalCss.matchAll(fontUrlPattern)];
  for (const match of matches) {
    const rawUrl = match[1].trim();
    const unquoted = stripQuotes(rawUrl);
    if (!unquoted.startsWith(fontDirPrefix)) {
      continue;
    }
    const basePath = unquoted.split(/[?#]/)[0];
    if (fontDataCache.has(basePath)) {
      continue;
    }
    const extension = extname(basePath).toLowerCase();
    const mimeType = FONT_MIME_TYPES.get(extension);
    if (!mimeType) {
      throw new Error(`Unsupported font extension for inlining: ${basePath}`);
    }
    const fontAbsPath = resolve(baseDir, basePath);
    const fontBytes = await readFile(fontAbsPath);
    fontDataCache.set(basePath, `data:${mimeType};base64,${fontBytes.toString('base64')}`);
  }

  if (fontDataCache.size === 0) {
    return originalCss;
  }

  return originalCss.replace(fontUrlPattern, (fullMatch, rawUrl) => {
    const trimmed = rawUrl.trim();
    const unquoted = stripQuotes(trimmed);
    if (!unquoted.startsWith(fontDirPrefix)) {
      return fullMatch;
    }
    const basePath = unquoted.split(/[?#]/)[0];
    const dataUri = fontDataCache.get(basePath);
    if (!dataUri) {
      return fullMatch;
    }
    return `url("${dataUri}")`;
  });
}

for (const config of inlineFontPackages) {
  const destRel = join(config.pkgName, config.targetCssRel).replace(/\\/g, '/');
  const destPath = join(outputRoot, destRel);
  let expectedCss;
  try {
    expectedCss = await buildInlinedCss(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    problems.push(`Failed to inline fonts for ${destRel}: ${message}`);
    continue;
  }

  if (checkOnly) {
    let actualCss;
    try {
      actualCss = await readFile(destPath, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        problems.push(`Missing file: ${destRel}`);
        continue;
      }
      throw error;
    }
    if (actualCss !== expectedCss) {
      problems.push(`Out of date: ${destRel}`);
    }
  } else {
    await ensureDir(dirname(destPath));
    await writeFile(destPath, expectedCss, 'utf8');
  }
}

async function listDestFiles(rootDir, prefix = '') {
  const abs = join(rootDir, prefix);
  const entries = await readdir(abs, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.name === '.gitignore') {
      continue;
    }
    const nextPrefix = join(prefix, entry.name);
    const absPath = join(rootDir, nextPrefix);
    if (entry.isDirectory()) {
      files.push(...await listDestFiles(rootDir, nextPrefix));
    } else if (entry.isFile()) {
      files.push({ rel: nextPrefix.replace(/\\/g, '/'), absPath });
    }
  }
  return files;
}

let extraneous = [];
try {
  extraneous = await listDestFiles(outputRoot);
} catch (error) {
  if (error && error.code !== 'ENOENT') {
    throw error;
  }
}

for (const { rel, absPath } of extraneous) {
  if (!expectedFiles.has(rel)) {
    if (checkOnly) {
      problems.push(`Unexpected file: ${rel}`);
    } else {
      await rm(absPath, { force: true });
    }
  }
}

if (checkOnly) {
  if (problems.length > 0) {
    console.error('Vendor verification failed:\n' + problems.join('\n'));
    console.error('\nKjør `npm run materialize-vendor` for å oppdatere vendorfiler fra `node_modules`.');
    process.exitCode = 1;
  } else {
    console.log('Vendor assets are up to date.');
  }
} else {
  if (problems.length > 0) {
    console.error('Encountered issues while copying vendor assets:\n' + problems.join('\n'));
    process.exitCode = 1;
  }
}
