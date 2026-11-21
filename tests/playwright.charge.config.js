// Tests de charge (audit hebdomadaire) : npx playwright test -c playwright.charge.config.js
const base = require('./playwright.config.js');
module.exports = { ...base, testDir: './charge', timeout: 300_000, retries: 0, workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'rapport-charge/html' }]] };
