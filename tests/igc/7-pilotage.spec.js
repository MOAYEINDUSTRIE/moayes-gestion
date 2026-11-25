// IGC Pilotage 4.0 (séminaire Collectivités 4.0, module 4) : PTA, suivi, taux, bilan, export.
const { test, expect } = require('@playwright/test');
test('PTA importé, suivi, taux physiques et financiers, bilan et demande d\'analyse', async ({ page }) => {
  const err = []; page.on('pageerror', e => err.push(String(e)));
  await page.route(u => u.hostname && !['localhost', '127.0.0.1'].includes(u.hostname), r => r.abort());
  await page.goto('/pilotage/index.html');
  await expect(page.locator('#kpis')).toContainText('activités au PTA');
  await page.fill('#jour', '2026-11-25'); await page.locator('#jour').dispatchEvent('change');
  await expect(page.locator('main')).toContainText('Points d\'attention');
  await page.click('a[href="#pta"]');
  await page.fill('#imp', '| Axe | Activité | Responsable | Début | Échéance | Indicateur | Cible | Budget |\n|---|---|---|---|---|---|---|---|\n| Santé | Campagne de vaccination | Service social | 01/03/2026 | 30/06/2026 | Enfants | 500 | 2 000 000 F |');
  await page.click('#bimp');
  await expect(page.locator('main')).toContainText('Campagne de vaccination');
  const a = await page.evaluate(() => JSON.parse(localStorage.getItem('igc_pilotage')).acts.pop());
  expect([a.deb, a.ech, a.cible, a.budget]).toEqual(['2026-03-01', '2026-06-30', 500, 2000000]);
  await page.click('a[href="#bilan"]');
  const b = await page.inputValue('#bil');
  expect(b).toContain('BILAN DE SUIVI DU PTA'); expect(b).toContain('Exécution financière : 55 %');   // 67 650 000 / 123 000 000
  expect(await page.inputValue('#dem')).toContain('N\'invente aucune réalisation');
  expect(err).toEqual([]);
});
