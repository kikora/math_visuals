#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'public');
const paletteDistSource = path.join(projectRoot, 'packages', 'palette', 'dist');
const paletteDistDestination = path.join(outputDir, 'packages', 'palette', 'dist');

const EXCLUDED_ENTRIES = new Set([
  'api',
  'docs',
  'infra',
  'node_modules',
  'packages',
  'palette',
  'scripts',
  'tests',
  'public',
  '.git',
  '.github',
  '.vercel',
  '.vscode',
  '.idea',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  '.editorconfig',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'README.md',
  'deployment-notes.md',
  'vercel.json',
  'playwright.config.js',
  'test-results.log',
]);

function log(message) {
  process.stdout.write(`${message}\n`);
}

function ensureCleanOutput() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
}

function shouldExclude(entryName) {
  if (EXCLUDED_ENTRIES.has(entryName)) {
    return true;
  }
  if (entryName.startsWith('.')) {
    return true;
  }
  return false;
}

function copyEntry(entryName) {
  const sourcePath = path.join(projectRoot, entryName);
  const destinationPath = path.join(outputDir, entryName);
  const stats = fs.statSync(sourcePath);
  if (stats.isDirectory()) {
    fs.cpSync(sourcePath, destinationPath, { recursive: true });
  } else if (stats.isFile()) {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function buildPublicDirectory() {
  ensureCleanOutput();
  const entries = fs.readdirSync(projectRoot);
  let copiedCount = 0;
  for (const entryName of entries) {
    if (shouldExclude(entryName)) {
      continue;
    }
    copyEntry(entryName);
    copiedCount += 1;
  }
  log(`Copied ${copiedCount} entries to public/ (excluding build metadata).`);
}

function copyPalettePackageDist() {
  if (!fs.existsSync(paletteDistSource)) {
    log('Skipped copying packages/palette/dist (missing build output).');
    return;
  }
  fs.mkdirSync(path.dirname(paletteDistDestination), { recursive: true });
  fs.cpSync(paletteDistSource, paletteDistDestination, { recursive: true });
  log('Copied packages/palette/dist into public/.');
}

buildPublicDirectory();
copyPalettePackageDist();
