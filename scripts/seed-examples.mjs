#!/usr/bin/env node
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_DATASET_PATH = path.join(ROOT_DIR, 'docs', 'examples-seed.json');
const SAMPLE_DATASET_PATH = path.join(ROOT_DIR, 'docs', 'examples-seed.sample.json');
const requiredKeys = ['REDIS_ENDPOINT', 'REDIS_PORT', 'REDIS_PASSWORD'];

const require = createRequire(import.meta.url);
const {
  normalizePath,
  setEntry,
  setTrashEntries,
  getStoreMode,
  isKvConfigured,
  KvConfigurationError,
  validateEntryPayload
} = require('../api/_lib/examples-store.js');

function printHelp() {
  console.log('Bruk: node scripts/seed-examples.mjs [--dataset=fil.json] [--dry-run] [--help]');
  console.log('');
  console.log('Skriptet fyller Redis-lageret med standardeksemplene definert i docs/examples-seed.json.');
  console.log('Filen er git-ignorert – bruk docs/examples-seed.sample.json som utgangspunkt.');
  console.log('  --dataset   Sti til JSON-fil med entries/trash (standard: docs/examples-seed.json).');
  console.log('  --dry-run   Leser og validerer datasettet uten å skrive til lagringen.');
  console.log('  --help      Viser denne hjelpen.');
}

function parseArgs(argv) {
  const options = {
    datasetPath: DEFAULT_DATASET_PATH,
    dryRun: false,
    help: false
  };
  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg.startsWith('--dataset=')) {
      const candidate = arg.slice('--dataset='.length).trim();
      if (candidate) {
        options.datasetPath = path.resolve(candidate);
      }
      continue;
    }
  }
  return options;
}

function verifyEnvironment() {
  const missing = requiredKeys.filter(key => !process.env[key] || !String(process.env[key]).trim());
  if (missing.length > 0) {
    throw new Error(
      `Mangler miljøvariabler: ${missing.join(', ')}. Hent verdiene via infra/data-template-outputs før du prøver igjen.`
    );
  }
  if (!isKvConfigured()) {
    throw new KvConfigurationError('Examples KV er ikke konfigurert. Sett REDIS_* variablene før du seed-er.');
  }
  const mode = getStoreMode();
  if (mode !== 'kv') {
    throw new Error(`Eksempellageret svarer med modus "${mode}". Seeding krever en Redis-tilkobling (mode "kv").`);
  }
}

async function loadDataset(datasetPath) {
  const resolvedPath = path.resolve(datasetPath);
  let raw;
  try {
    raw = await readFile(resolvedPath, 'utf8');
  } catch (error) {
    const missingFileHint = error && error.code === 'ENOENT'
      ? ` Opprett filen ved å kopiere ${SAMPLE_DATASET_PATH}.`
      : '';
    throw new Error(
      `Kunne ikke lese datasettet (${resolvedPath}): ${error && error.message ? error.message : error}.${missingFileHint}`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Datasettet (${resolvedPath}) inneholder ugyldig JSON (må være ren JSON uten kommentarer): ` +
      `${error && error.message ? error.message : error}`
    );
  }
  if (Array.isArray(parsed)) {
    return { entries: parsed, trash: [] };
  }
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const trash = Array.isArray(parsed.trash)
    ? parsed.trash
    : Array.isArray(parsed.trashEntries)
      ? parsed.trashEntries
      : [];
  return { entries, trash };
}

function sanitizeEntryPayload(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const normalizedPath = normalizePath(entry.path || entry.storagePath || entry.tool || '');
  if (!normalizedPath) return null;
  return {
    path: normalizedPath,
    payload: {
      examples: Array.isArray(entry.examples) ? entry.examples : [],
      deletedProvided: Array.isArray(entry.deletedProvided) ? entry.deletedProvided : []
    }
  };
}

function validateDatasetEntries(entries, sourcePath) {
  const errors = [];
  const sanitized = [];

  for (const entry of entries || []) {
    const payload = sanitizeEntryPayload(entry);
    if (!payload) {
      errors.push('Fant en oppføring uten gyldig path/tool. Legg til en "path"-verdi i datasettet.');
      continue;
    }
    const validation = validateEntryPayload(payload.payload);
    if (!validation.ok) {
      const message = validation.reason || 'Payload must be clean JSON';
      const label = payload.path ? ` for ${payload.path}` : '';
      errors.push(`Ugyldig payload${label}: ${message}`);
      continue;
    }
    sanitized.push(payload);
  }

  if (errors.length > 0) {
    const locationHint = sourcePath ? ` (${sourcePath})` : '';
    throw new Error(
      `Datasettet${locationHint} er ikke klart til seeding:\n- ${errors.join('\n- ')}\n` +
      'Pass på at filen er ren JSON (uten kommentarer) og at verdiene matcher API-validatoren.'
    );
  }

  return sanitized;
}

async function seedEntries(entries, { dryRun }) {
  let ensured = 0;
  let skipped = 0;
  const failures = [];
  for (const entry of entries || []) {
    const { path: normalizedPath, payload: data } = entry;
    const label = data.examples.length === 1
      ? `${normalizedPath} (${data.examples.length} eksempel)`
      : `${normalizedPath} (${data.examples.length} eksempler)`;
    if (dryRun) {
      console.log(`[tørrkjøring] Ville skrevet ${label}.`);
      ensured += 1;
      continue;
    }
    try {
      await setEntry(normalizedPath, data);
      console.log(`✅ Skrev ${label}.`);
      ensured += 1;
    } catch (error) {
      failures.push({ path: normalizedPath, error });
      console.error(`❌  Klarte ikke å skrive ${normalizedPath}:`, error && error.message ? error.message : error);
    }
  }
  return { ensured, skipped, failures };
}

async function seedTrashEntries(trashEntries, { dryRun }) {
  const entries = Array.isArray(trashEntries) ? trashEntries : [];
  if (!entries.length) {
    return { updated: 0, failed: null };
  }
  if (dryRun) {
    console.log(`[tørrkjøring] Ville oppdatert ${entries.length} papirkurv-oppføring(er).`);
    return { updated: entries.length, failed: null };
  }
  try {
    await setTrashEntries(entries);
    console.log(`✅ Oppdaterte ${entries.length} papirkurv-oppføring(er).`);
    return { updated: entries.length, failed: null };
  } catch (error) {
    console.error('❌  Klarte ikke å oppdatere papirkurven:', error && error.message ? error.message : error);
    return { updated: 0, failed: error };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  try {
    verifyEnvironment();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
    return;
  }

  let dataset;
  try {
    dataset = await loadDataset(options.datasetPath);
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
    return;
  }

  let entries;
  try {
    entries = validateDatasetEntries(dataset.entries, options.datasetPath);
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
    return;
  }

  console.log('Starter seeding av eksempeltjenesten.');
  console.log(`Kilde: ${options.datasetPath}`);
  if (options.dryRun) {
    console.log('Tørrkjøring aktivert – ingen data skrives til Redis.');
  }

  console.log('Validering fullført – skriver payloadene med samme regler som API-et.');

  const entryResult = await seedEntries(entries, options);
  const trashResult = await seedTrashEntries(dataset.trash, options);

  if (entryResult.failures.length > 0 || trashResult.failed) {
    process.exitCode = 1;
    console.error('Fullførte med feil. Minst én oppføring eller papirkurvskriving feilet.');
  } else {
    console.log(`Ferdig. ${entryResult.ensured} oppføring(er) skrevet (${entryResult.skipped} hoppet over).`);
    if (dataset.trash && dataset.trash.length) {
      console.log(`Papirkurv oppdatert med ${dataset.trash.length} oppføring(er).`);
    }
  }
}

main().catch(error => {
  console.error('Uventet feil under seeding:', error && error.message ? error.message : error);
  process.exitCode = 1;
});
