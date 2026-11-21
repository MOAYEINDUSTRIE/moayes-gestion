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

test('catalogue rangé selon les 5 métiers des statuts, ancien classement repris', async ({ page }) => {
  const r = await page.evaluate(() => {
    const neuf = { n: DATA.catalogue.length, horsMetier: DATA.catalogue.filter(p => !CAT_FAM.includes(p.cat)).length };
    // appareil resté sur l'ancien classement : 25 prestations, anciennes familles, prix modifié
    DATA.catalogue = DATA.catalogue.filter(p => !/^P-(ELE-1[01]|INS|COR|CON-0[4-7]|GEN)/.test(p.id)).map(p => ({ ...p, cat: ({ 'P-ELE': 'Électoral', 'P-COM': 'Communication', 'P-CON': 'Conseil stratégique', 'P-CRE': 'Création de structures', 'P-FOR': 'Formation', 'P-ANX': 'Frais annexes' })[p.id.slice(0, 5)], rub: undefined }));
    get('catalogue', 'P-CON-01').pu = 300000;
    const avant = DATA.catalogue.length; migrerCatalogue();
    return { neuf, avant, apres: DATA.catalogue.length, horsMetier: DATA.catalogue.filter(p => !CAT_FAM.includes(p.cat)).length,
      app: get('catalogue', 'P-CRE-05'), conseil: get('catalogue', 'P-CON-01'), metiers: CAT_FAM.slice(0, 5) };
  });
  expect(r.neuf).toEqual({ n: 41, horsMetier: 0 });
  expect(r.avant).toBe(25); expect(r.apres).toBe(41); expect(r.horsMetier).toBe(0);
  expect(r.app.cat).toBe('Communication générale'); expect(r.app.rub).toBe('Communication digitale');
  expect(r.conseil.pu).toBe(300000);                      // prix modifié conservé
  expect(r.metiers).toEqual(['Communication politique et électorale', 'Communication institutionnelle et affaires publiques', 'Communication d\'entreprise et corporate', 'Consultance stratégique et advisory', 'Communication générale']);
});

test('le métier de la prestation figure sous la ligne du devis imprimé', async ({ page, context }) => {
  await page.evaluate(() => { put('clients', { id: 'C1', nom: 'Client test' }); editDevis(null, 'C1'); });
  await page.selectOption('#x_cat', 'P-GEN-01');
  const l = await page.evaluate(() => readDoc().lignes[0]);
  expect(l.m).toBe('Communication générale');
  await page.evaluate(l => put('devis', { id: 'D2', num: 'IGC-D-T2', clientId: 'C1', date: today(), objet: 'Logo', lignes: [l], statut: 'brouillon' }), l);
  const [pop] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => printDoc('devis', 'D2'))]);
  await pop.waitForLoadState();
  expect(texte(await pop.content())).toContain('Création de logo et charte graphique Communication générale');
  await pop.close();
});
