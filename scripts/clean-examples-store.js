#!/usr/bin/env node
'use strict';

const path = require('path');

const REDIS_ENV_KEYS = [
  'REDIS_HOST',
  'REDIS_ENDPOINT',
  'REDIS_SERVER',
  'REDIS_ADDRESS',
  'REDIS_URL',
  'REDIS_URI',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_AUTH_TOKEN',
  'REDIS_SECRET',
  'REDIS_PASS',
  'REDIS_DB',
  'REDIS_DATABASE',
  'REDIS_TLS',
  'REDIS_USE_TLS'
];

function parseArgs(argv) {
  const args = { dryRun: true, mode: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      break;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--no-dry-run') {
      args.dryRun = false;
      continue;
    }
    if (arg === '--mode' && i + 1 < argv.length) {
      args.mode = String(argv[i + 1]).trim().toLowerCase();
      i += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      args.mode = arg.split('=')[1].trim().toLowerCase();
      continue;
    }
  }
  return args;
}

function enforceMemoryMode() {
  REDIS_ENV_KEYS.forEach(key => {
    delete process.env[key];
  });
}

function printUsage() {
  const scriptName = path.basename(__filename);
  console.log(`Usage: node scripts/${scriptName} [--mode memory|kv] [--dry-run|--no-dry-run]\n`);
  console.log('Iterates over example entries and trash, repairing or removing items that violate the clean JSON rules.');
  console.log('Defaults to dry-run mode. Use --no-dry-run to apply changes.');
  console.log('Use --mode to explicitly run against memory or KV storage (defaults to environment detection).');
}

const cli = parseArgs(process.argv.slice(2));
if (cli.help) {
  printUsage();
  process.exit(0);
}

if (cli.mode === 'memory') {
  enforceMemoryMode();
}

const exampleStore = require('../api/_lib/examples-store.js');

const {
  listEntries,
  getEntry,
  setEntry,
  deleteEntry,
  getTrashEntries,
  setTrashEntries,
  validateEntryPayload,
  getStoreMode,
  __serializeExampleValue: serializeExampleValue
} = exampleStore;

function ensureModeAllowed(requestedMode) {
  const activeMode = getStoreMode();
  if (requestedMode === 'kv' && activeMode !== 'kv') {
    throw new Error('KV mode requested but KV is not configured.');
  }
  if (requestedMode === 'memory' && activeMode !== 'memory') {
    throw new Error('Memory mode requested but KV configuration is present; rerun without Redis environment variables to force memory mode.');
  }
  return activeMode;
}

function validateExamples(examples) {
  return validateEntryPayload({ examples });
}

function serializeExamples(examples) {
  if (!Array.isArray(examples)) return [];
  const serialized = [];
  examples.forEach(example => {
    const encoded = serializeExampleValue(example);
    if (encoded !== undefined) {
      serialized.push(encoded);
    }
  });
  return serialized;
}

function sanitizeDeleted(deletedProvided) {
  if (!Array.isArray(deletedProvided)) return [];
  const seen = new Set();
  const sanitized = [];
  deletedProvided.forEach(item => {
    if (typeof item !== 'string') return;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    sanitized.push(trimmed);
  });
  return sanitized;
}

function buildRepairedPayload(entry) {
  const examples = serializeExamples(entry.examples);
  const deletedProvided = sanitizeDeleted(entry.deletedProvided);
  const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString();
  const repaired = { examples, deletedProvided, updatedAt };
  const validation = validateEntryPayload(repaired);
  return validation.ok ? repaired : null;
}

function validateTrashEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return { ok: false, reason: 'Entry is not an object' };
  }
  const exampleCheck = validateExamples([entry.example]);
  if (!exampleCheck.ok) {
    return { ok: false, reason: `example: ${exampleCheck.reason}` };
  }
  if (entry.metadata !== undefined) {
    const metadataCheck = validateExamples([entry.metadata]);
    if (!metadataCheck.ok) {
      return { ok: false, reason: `metadata: ${metadataCheck.reason}` };
    }
  }
  return { ok: true };
}

function repairTrashEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const repaired = { ...entry };
  const serializedExample = serializeExampleValue(entry.example);
  if (serializedExample === undefined) return null;
  repaired.example = serializedExample;
  if (entry.metadata !== undefined) {
    const serializedMetadata = serializeExampleValue(entry.metadata);
    if (serializedMetadata !== undefined) {
      repaired.metadata = serializedMetadata;
    } else {
      delete repaired.metadata;
    }
  }
  const validation = validateTrashEntry(repaired);
  return validation.ok ? repaired : null;
}

async function processEntries(dryRun) {
  const entries = await listEntries();
  const summary = { inspected: 0, repaired: 0, deleted: 0, unchanged: 0 };
  for (const entry of entries) {
    summary.inspected += 1;
    const current = await getEntry(entry.path);
    if (!current) {
      summary.deleted += 1;
      continue;
    }
    const validation = validateEntryPayload({
      examples: current.examples,
      deletedProvided: current.deletedProvided,
      updatedAt: current.updatedAt
    });
    if (validation.ok) {
      summary.unchanged += 1;
      continue;
    }
    const repairedPayload = buildRepairedPayload(current);
    if (repairedPayload) {
      summary.repaired += 1;
      if (!dryRun) {
        await setEntry(current.path, repairedPayload);
      }
    } else {
      summary.deleted += 1;
      if (!dryRun) {
        await deleteEntry(current.path);
      }
    }
  }
  return summary;
}

async function processTrash(dryRun) {
  const trash = await getTrashEntries();
  const summary = { inspected: trash.length, repaired: 0, deleted: 0, unchanged: 0 };
  const repairedList = [];
  for (const entry of trash) {
    const validation = validateTrashEntry(entry);
    if (validation.ok) {
      repairedList.push(entry);
      summary.unchanged += 1;
      continue;
    }
    const repaired = repairTrashEntry(entry);
    if (repaired) {
      summary.repaired += 1;
      repairedList.push(repaired);
    } else {
      summary.deleted += 1;
    }
  }
  if (!dryRun && (summary.repaired > 0 || summary.deleted > 0)) {
    await setTrashEntries(repairedList);
  }
  return summary;
}

async function main() {
  const activeMode = ensureModeAllowed(cli.mode);
  console.log(`Running clean-up in ${activeMode.toUpperCase()} mode${cli.dryRun ? ' (dry-run)' : ''}`);

  const entrySummary = await processEntries(cli.dryRun);
  console.log('Entries summary:', entrySummary);

  const trashSummary = await processTrash(cli.dryRun);
  console.log('Trash summary:', trashSummary);

  if (cli.dryRun) {
    console.log('Dry-run complete. Re-run with --no-dry-run to apply changes.');
  }
}

main().catch(error => {
  console.error('Maintenance failed:', error);
  process.exitCode = 1;
});
