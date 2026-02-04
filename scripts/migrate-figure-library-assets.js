#!/usr/bin/env node
'use strict';

const process = require('node:process');

const {
  listSvgs,
  deleteSvg
} = require('../api/_lib/svg-store');
const {
  setFigureAsset
} = require('../api/_lib/figure-asset-store');
const {
  FIGURE_LIBRARY_UPLOAD_TOOL_ID
} = require('../api/_lib/figure-library-store');

function printUsage() {
  console.log('Bruk: node scripts/migrate-figure-library-assets.js [--dry-run] [--help]');
  console.log('');
  console.log('Flytter figurbibliotek-eksporter fra /api/svg til den dedikerte figure-asset-lagringen.');
  console.log('  --dry-run   Viser hvilke oppføringer som ville blitt migrert uten å endre lagringen.');
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

function isFigureLibraryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const tool = typeof entry.tool === 'string' ? entry.tool.trim() : '';
  const toolId = typeof entry.toolId === 'string' ? entry.toolId.trim() : '';
  return tool === FIGURE_LIBRARY_UPLOAD_TOOL_ID || toolId === FIGURE_LIBRARY_UPLOAD_TOOL_ID;
}

function buildAssetPayload(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const {
    storage,
    mode,
    storageMode,
    persistent,
    ephemeral,
    ...rest
  } = entry;
  return { ...rest };
}

async function migrateEntries({ dryRun }) {
  const entries = await listSvgs();
  const candidates = entries.filter(isFigureLibraryEntry);

  if (!candidates.length) {
    console.log('Fant ingen figurbibliotek-oppføringer i /api/svg.');
    return { migrated: 0, skipped: 0, total: 0 };
  }

  console.log(`Fant ${candidates.length} figurbibliotek-oppføring${candidates.length === 1 ? '' : 'er'} i /api/svg.`);
  let migrated = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const slug = candidate.slug || candidate.id || '(ukjent slug)';
    const payload = buildAssetPayload(candidate);
    if (!payload || !payload.slug) {
      console.warn(`⚠️  Hopper over ${slug} – mangler gyldig slug i oppføringen.`);
      skipped += 1;
      continue;
    }

    console.log(`${dryRun ? '[tørrkjøring] ' : ''}Migrerer ${payload.slug}`);

    if (dryRun) {
      migrated += 1;
      continue;
    }

    try {
      await setFigureAsset(payload.slug, payload);
      await deleteSvg(payload.slug);
      migrated += 1;
    } catch (error) {
      skipped += 1;
      console.error(`❌  Kunne ikke migrere ${payload.slug}: ${error && error.message ? error.message : error}`);
    }
  }

  return { migrated, skipped, total: candidates.length };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  try {
    const result = await migrateEntries(options);
    if (options.dryRun) {
      console.log(`Tørrkjøring ferdig – ${result.total} oppføringer ville blitt migrert.`);
    } else {
      console.log(`Migrering ferdig: ${result.migrated} migrert, ${result.skipped} hoppet over.`);
    }
  } catch (error) {
    console.error('Migreringen feilet:', error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  migrateEntries
};
