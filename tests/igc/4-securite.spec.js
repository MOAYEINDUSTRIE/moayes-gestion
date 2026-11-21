// Codes PIN, blocage, politique de sécurité du contenu.
const { test, expect } = require('@playwright/test');
const { ouvrir, entrer, sansErreur } = require('./outils');

test('codes PIN chiffrés (PBKDF2), codes faciles refusés', async ({ page }) => {
  const erreurs = await ouvrir(page); await entrer(page);
  await page.evaluate(() => go('parametres'));
  await page.fill('#pin_n', '1111'); await page.evaluate(() => savePin());
  expect(await page.evaluate(() => DATA._pins.gerant || null)).toBeNull();
  await page.fill('#pin_n', '482913'); await page.evaluate(() => savePin());
  await page.waitForFunction(() => !!DATA._pins.gerant);
  expect(await page.evaluate(() => DATA._pins.gerant)).toMatch(/^p2\$210000\$/);
  await sansErreur(erreurs);
});

test('blocage après 5 codes faux, consigné au journal', async ({ page }) => {
  const erreurs = await ouvrir(page);
  for (let k = 0; k < 6; k++) await page.evaluate(() => { if (document.querySelector('.modal-bg')) closeModal(); PIN = '99999999'; return pinKey('OK'); });
  const v = await page.evaluate(() => verrou());
  expect(v.n).toBe(5); expect(v.jusqua).toBeGreaterThan(Date.now());
  expect(await page.evaluate(() => DATA.audit[0].a)).toContain('Code PIN refusé');
  await sansErreur(erreurs);
});

test('politique de sécurité du contenu présente', async ({ page }) => {
  await ouvrir(page);
  const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain('gstatic');
});
