#!/usr/bin/env node
import process from 'node:process';

const DEFAULT_URL = 'http://localhost:3000/api/examples';

function printHelp() {
  console.log('Slik bruker du skriptet:');
  console.log('  node scripts/sanitize-examples.mjs [--url=URL] [--path=sti] [--all] [--dry-run]');
  console.log('');
  console.log('Standard-URL er http://localhost:3000/api/examples.');
  console.log('Bruk --path flere ganger for å spesifisere én eller flere paths.');
  console.log('Flagget --all tømmer alle entries fra API-et.');
  console.log('Legg til --dry-run for å se hva som ville blitt slettet uten å gjøre endringer.');
}

function parseArgs(argv) {
  const result = { url: DEFAULT_URL, paths: [], all: false, dryRun: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }
    if (arg === '--all') {
      result.all = true;
      continue;
    }
    if (arg === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (arg.startsWith('--url=')) {
      const value = arg.slice('--url='.length).trim();
      if (value) result.url = value.replace(/\/+$/, '');
      continue;
    }
    if (arg.startsWith('--path=')) {
      const value = arg.slice('--path='.length).trim();
      if (value) result.paths.push(value);
      continue;
    }
  }
  return result;
}

function buildDeleteUrl(baseUrl, path) {
  const connector = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${connector}path=${encodeURIComponent(path)}`;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }
  return { response, data };
}

async function fetchEntries(baseUrl) {
  const { response, data } = await fetchJson(baseUrl, {
    headers: {
      Accept: 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`API-et svarte med status ${response.status}.`);
  }
  if (!Array.isArray(data && data.entries)) {
    throw new Error('API-et returnerte ikke entries.');
  }
  return data.entries
    .map(entry => (entry && typeof entry.path === 'string' ? entry.path.trim() : null))
    .filter(Boolean);
}

async function deleteEntry(baseUrl, path, { dryRun }) {
  if (dryRun) {
    console.log(`🚧 Dry run: ville slettet ${path}`);
    return { ok: true, dryRun: true };
  }
  const url = buildDeleteUrl(baseUrl, path);
  const { response, data } = await fetchJson(url, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    const message = data && data.error ? ` (${data.error})` : '';
    throw new Error(`Sletting av ${path} feilet med status ${response.status}${message}`);
  }
  return { ok: true, dryRun: false };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
    return;
  }

  if (!args.all && args.paths.length === 0) {
    console.error('Du må oppgi minst én --path eller bruke --all.');
    printHelp();
    process.exit(1);
    return;
  }

  const targetUrl = args.url.replace(/\/+$/, '');
  console.log(`Saniterer eksempler via ${targetUrl} ...`);

  let paths = args.paths;
  if (args.all) {
    try {
      paths = await fetchEntries(targetUrl);
      if (!paths.length) {
        console.log('Ingen entries å slette.');
        return;
      }
      console.log(`Fant ${paths.length} entries som saniteres.`);
    } catch (error) {
      console.error('Klarte ikke å hente oversikt over entries:', error.message || error);
      process.exitCode = 1;
      return;
    }
  }

  let failures = 0;
  for (const path of paths) {
    try {
      await deleteEntry(targetUrl, path, { dryRun: args.dryRun });
      if (!args.dryRun) {
        console.log(`🧹 Slettet ${path}`);
      }
    } catch (error) {
      failures++;
      console.error(`Kunne ikke slette ${path}:`, error.message || error);
    }
  }

  if (failures > 0) {
    console.error(`Sanitering ferdig med ${failures} feil.`);
    process.exitCode = 1;
  } else {
    console.log(args.dryRun ? 'Dry run ferdig uten feil.' : 'Sanitering ferdig.');
  }
}

await main();
