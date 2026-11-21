// Chaque écran s'ouvre sans erreur, hors ligne, sans appel à un site tiers.
const { test, expect } = require('@playwright/test');
const { ouvrir, entrer, sansErreur } = require('./outils');
// Seuls services admis : la connexion Google et la base Firebase du cabinet (déjà permis par la politique de sécurité).
const AUTORISES = /(^apis\.google\.com|\.googleapis\.com|\.firebaseio\.com|\.firebasedatabase\.app|\.firebaseapp\.com)$/;

test('tous les écrans s\'ouvrent sans erreur', async ({ page }) => {
  const externes = [];
  page.on('request', r => { const h = new URL(r.url()).hostname; if (!['localhost', '127.0.0.1'].includes(h) && !AUTORISES.test(h)) externes.push(h); });
  const erreurs = await ouvrir(page);
  await entrer(page);
  const vues = await page.evaluate(() => Object.keys(VIEWS).filter(v => !['client', 'facture', 'ordre', 'circo'].includes(v)));
  expect(vues.length).toBeGreaterThan(15);
  for (const v of vues) {
    await page.evaluate(x => go(x), v);
    await expect(page.locator('main').first()).not.toBeEmpty();
  }
  expect(externes, 'appels à des sites non autorisés').toEqual([]);
  await sansErreur(erreurs);
});

test('la version affichée est celle du code', async ({ page }) => {
  await ouvrir(page);
  const v = await page.evaluate(() => VERSION);
  expect(v).toMatch(/^V\d+\.\d+$/);
  await expect(page.locator('body')).toContainText(v);
});
