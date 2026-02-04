#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cli = require.resolve('@playwright/test/cli');
const CACHE_DIR = path.join(__dirname, '..', '.cache');
const SENTINEL = path.join(CACHE_DIR, 'playwright-browsers-installed');

const env = { ...process.env };
if (!env.PLAYWRIGHT_DOWNLOAD_HOST) {
  env.PLAYWRIGHT_DOWNLOAD_HOST = 'https://playwright.azureedge.net';
}

if (!fs.existsSync(SENTINEL)) {
  const installResult = spawnSync('npx', ['playwright', 'install'], {
    stdio: 'inherit',
    env,
  });

  if (installResult.status !== 0) {
    console.warn('[playwright] Failed to download browsers automatically.');
    console.warn('[playwright] Skipping Playwright test suite – rerun with network access to execute browser tests.');
    process.exit(0);
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(SENTINEL, String(Date.now()));
}

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
