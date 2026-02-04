#!/usr/bin/env node
import process from 'node:process';

const DEFAULT_URL = 'http://localhost:3000/api/examples';

function parseArgs(argv) {
  const result = { url: DEFAULT_URL, path: null, listPaths: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }
    if (arg === '--list-paths') {
      result.listPaths = true;
      continue;
    }
    if (arg.startsWith('--url=')) {
      const value = arg.slice('--url='.length).trim();
      if (value) result.url = value;
      continue;
    }
    if (arg.startsWith('--path=')) {
      const value = arg.slice('--path='.length).trim();
      if (value) result.path = value;
      continue;
    }
  }
  if (result.url.endsWith('/')) {
    result.url = result.url.replace(/\/+$/, '');
  }
  return result;
}

function printHelp() {
  console.log('Slik bruker du skriptet:');
  console.log('  node scripts/check-examples-api.mjs [--url=URL] [--path=sti] [--list-paths]');
  console.log('');
  console.log('Standard-URL er http://localhost:3000/api/examples.');
  console.log('Hvis du oppgir --path, sjekkes ett bestemt verktøy.');
  console.log('Bruk --list-paths for å skrive ut lagrede paths når API-et returnerer entries.');
}

function describeMode(mode) {
  if (!mode) return 'ukjent';
  const normalized = String(mode).trim().toLowerCase();
  if (!normalized) return 'ukjent';
  if (normalized === 'kv') return 'varig lagring (KV)';
  if (normalized === 'memory') return 'midlertidig minne';
  return normalized;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json'
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }
  return { response, data };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
    return;
  }

  let targetUrl = args.url;
  if (args.path) {
    const connector = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${connector}path=${encodeURIComponent(args.path)}`;
  }

  console.log(`Sjekker ${targetUrl} ...`);

  try {
    const { response, data } = await fetchJson(targetUrl);
    if (!response.ok) {
      console.error(`❌ API-et svarte med status ${response.status}.`);
      if (data && data.error) {
        console.error(`Melding: ${data.error}`);
      } else if (response.status === 404) {
        console.error('Fant ikke stien på API-et.');
        if (args.path) {
          console.error(`Tips: Verktøyet «${args.path}» har kanskje ikke lagrede eksempler ennå.`);
          console.error('      Åpne verktøyet og lagre et eksempel, eller fjern --path for å sjekke hele API-et.');
        } else {
          console.error('Tips: Sjekk at URL-en peker til /api/examples i miljøet du vil teste.');
          console.error('      Bruk --url=https://<domene>/api/examples for å teste en annen server, eller start dev-serveren lokalt.');
        }
      }
      process.exitCode = 1;
      return;
    }

    const mode = data && (data.mode || data.storageMode || data.storage);
    const persistent = Boolean(data && (data.persistent || mode === 'kv'));

    if (Array.isArray(data.entries)) {
      console.log(`✅ Fikk ${data.entries.length} post(er). Lagres i ${describeMode(mode)}.`);
      if (args.listPaths) {
        const paths = data.entries
          .map(entry => entry && entry.path)
          .filter(Boolean);
        if (paths.length) {
          console.log('Lagrede paths:');
          paths.forEach(value => console.log(`  - ${value}`));
        }
      }
      if (!persistent) {
        console.log('⚠️  Dette er midlertidig. Eksempler forsvinner når serveren starter på nytt.');
      }
      return;
    }

    if (data && Array.isArray(data.examples)) {
      console.log(`✅ Fikk en post med ${data.examples.length} eksempel(er). Lagres i ${describeMode(mode)}.`);
      if (args.listPaths && data.path) {
        console.log(`Lagret path: ${data.path}`);
      }
      if (!persistent) {
        console.log('⚠️  Dette er midlertidig. Eksempler forsvinner når serveren starter på nytt.');
      }
      return;
    }

    console.log('ℹ️  API-et svarte, men formatet var uventet.');
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
    if (!persistent) {
      console.log('⚠️  Sjekk at REDIS_ENDPOINT, REDIS_PORT og REDIS_PASSWORD er satt.');
    }
  } catch (error) {
    console.error('❌ Klarte ikke å kontakte API-et.');
    console.error(error && error.message ? error.message : error);
    console.error('Tips: Er back-end startet? Bruk --url for å peke til riktig adresse.');
    process.exitCode = 1;
  }
}

await main();
