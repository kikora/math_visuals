const { defineConfig, devices } = require('@playwright/test');

const CROSS_BROWSER_TESTS = 'tests/examples-cross-browser.spec.js';

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  globalSetup: require.resolve('./tests/global-setup.js'),
  use: {
    baseURL: 'http://127.0.0.1:4173',
    acceptDownloads: true
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      testMatch: CROSS_BROWSER_TESTS,
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      testMatch: CROSS_BROWSER_TESTS,
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npx http-server -c-1 -p 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
