// Tests automatiques d'IGC Gestion : chaque scénario tourne sur ordinateur et sur téléphone.
// En local : CHROME=/usr/bin/google-chrome npx playwright test
const { defineConfig, devices } = require('@playwright/test');
const exe = process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {};

module.exports = defineConfig({
  testDir: './igc',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'rapport' }]],
  use: { bypassCSP: true, baseURL: 'http://localhost:8790/igc/', launchOptions: exe, trace: 'retain-on-failure' },
  webServer: { command: 'python3 -m http.server 8790 -d ..', url: 'http://localhost:8790/igc/index.html', reuseExistingServer: true },
  projects: [
    { name: 'ordinateur', use: { viewport: { width: 1280, height: 850 } } },
    { name: 'telephone', use: { ...devices['Pixel 5'], launchOptions: exe } },
  ],
});
