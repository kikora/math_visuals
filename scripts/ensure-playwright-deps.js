#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const SENTINEL = path.join(CACHE_DIR, 'playwright-deps-installed');

if (process.env.SKIP_PLAYWRIGHT_DEPS_INSTALL) {
  process.exit(0);
}

if (process.platform !== 'linux') {
  process.exit(0);
}

if (fs.existsSync(SENTINEL)) {
  process.exit(0);
}

if (process.getuid && process.getuid() !== 0) {
  console.warn('[playwright] Missing browser system dependencies.');
  console.warn('[playwright] Skipping automatic installation because this process does not have root privileges.');
  console.warn('[playwright] Run `sudo npx playwright install-deps` manually if browser tests fail to launch.');
  process.exit(0);
}

const env = { ...process.env };
if (!env.PLAYWRIGHT_DOWNLOAD_HOST) {
  env.PLAYWRIGHT_DOWNLOAD_HOST = 'https://playwright.azureedge.net';
}

const result = spawnSync('npx', ['playwright', 'install-deps'], {
  stdio: 'inherit',
  env,
});
if (result.status !== 0) {
  console.error('[playwright] Failed to install system dependencies automatically.');
  console.error('Please run `npx playwright install-deps` manually to review the error output.');
  process.exit(result.status ?? 1);
}

fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.writeFileSync(SENTINEL, String(Date.now()));
