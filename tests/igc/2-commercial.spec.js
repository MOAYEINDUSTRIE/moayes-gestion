// Catalogue, devis, en-têtes légaux, contrat de mission, exports.
const { test, expect } = require('@playwright/test');
const { ouvrir, entrer, texte, sansErreur } = require('./outils');

test.beforeEach(async ({ page }) => { page.erreurs = await ouvrir(page); await entrer(page); });
test.afterEach(async ({ page }) => { await sansErreur(page.erreurs); });

test('le catalogue est pré-rempli et le prix passe dans le devis', async ({ page }) => {
  expect(await page.evaluate(() => DATA.catalogue.length)).toBeGreaterThanOrEqual(25);
  await page.evaluate(() => { put('clients', { id: 'C1', nom: 'Client test' }); editDevis(null, 'C1'); });
  await page.selectOption('#x_cat', 'P-ELE-01');
  const l = await page.evaluate(() => LIG.find(x => x.d));
  expect(l.pu).toBe(await page.evaluate(() => get('catalogue', 'P-ELE-01').pu));
});

test('devis et contrat portent RCCM, IDU et gérance', async ({ page, context }) => {
  await page.evaluate(() => { put('clients', { id: 'C1', nom: 'Client test' }); put('devis', { id: 'D1', num: 'IGC-D-TEST', clientId: 'C1', date: today(), objet: 'Test', lignes: [{ d: 'Étude', q: 1, pu: 1000 }], statut: 'brouillon' }); });
  for (const [appel, attendu] of [["printDoc('devis','D1')", ['RCCM CI-ABJ-03-2026-B12-07790', 'IDU CI-2026-0080678 D']], ["contratMission('devis','D1')", ['Gérante', 'Cogérant', 'Article 1']]]) {
    const [pop] = await Promise.all([context.waitForEvent('page'), page.evaluate(a => eval(a), appel)]);
    await pop.waitForLoadState();
    const t = texte(await pop.content());
    for (const a of attendu) expect(t, appel).toContain(a);
    expect(t, 'mot interdit dans un document client').not.toMatch(/\bIA\b/);
    await pop.close();
  }
});

test('un export CSV ne peut pas contenir de formule', async ({ page }) => {
  const ligne = await page.evaluate(() => { let out; const o = saveFile; saveFile = (n, t, c) => { out = c; }; DATA.depenses.push({ id: 'X', date: today(), cat: '=HYPERLINK("http://x")', desc: 'test', montant: -3 }); exportCSV('depenses'); saveFile = o; return out; });
  expect(ligne).toContain("\"'=HYPERLINK");
  expect(ligne).toContain('-3');
});
