// Règles électorales d'IGC (Squelette, Moaye 20/11/2026) et document remis au candidat.
const { test, expect } = require('@playwright/test');
const { ouvrir, entrer, texte, indexDe, sansErreur } = require('./outils');

const INTERDITS = ['IGC Gestion', 'Base de calcul', 'tout candidat', 'meilleur taux observé', '51 %', 'au candidat', 'Moaye'];

test.beforeEach(async ({ page }) => { page.erreurs = await ouvrir(page, { donnees: true }); await entrer(page); });
test.afterEach(async ({ page }) => { await sansErreur(page.erreurs); });

async function docClient(page, i) {
  return texte(await page.evaluate(x => { diagEtat(x).cand = 'M. TEST Candidat'; return candHTML(x, nettoyerClient(pourClient(() => etudeModele(x)))); }, i));
}

test('région N\'ZI : une coordination par bureau, 2 cellules, 50 % + 1', async ({ page }) => {
  const i = await indexDe(page, '^N ?ZI$', 3);
  expect(i).toBeGreaterThanOrEqual(0);
  const D = await page.evaluate(x => { const d = stratData(x); return { n: d.n, bv: d.bv, tot: d.tot, coord: d.coord, cel: d.cel }; }, i);
  expect(D).toEqual({ n: 218, bv: 352, tot: 107760, coord: 352, cel: 704 });   // CEI, répertoire 2025
  const t = await docClient(page, i);
  expect(t).toContain('50 % des votants + 1 voix');
  expect(t).toContain('1 056');                     // responsables à former = 352 + 704
  expect(t).toContain('plus grands lieux de vote');
  expect(t).toContain('À l’attention de M. TEST Candidat');
  for (const m of INTERDITS) expect(t, `« ${m} » ne doit pas figurer dans le document client`).not.toContain(m);
  expect(t).not.toMatch(/\bIA\b/);
});

test('mairie de Toumodi : la commune seule, sans la sous-préfecture', async ({ page }) => {
  const i = await indexDe(page, '^TOUMODI$', 2);
  const L = await page.evaluate(x => { const l = lvDe(x); return [l.length, l.reduce((s, y) => s + y[7], 0), l.reduce((s, y) => s + y[8], 0)]; }, i);
  expect(L).toEqual([26, 84, 31946]);              // circonscription 021 « Toumodi, commune »
});

test('tranches de 500 électeurs par bureau', async ({ page }) => {
  const r = await page.evaluate(() => [coordLieu(['', 0, 0, 0, 0, '', 'A', 1, 500]), coordLieu(['', 0, 0, 0, 0, '', 'B', 1, 501]), coordLieu(['', 0, 0, 0, 0, '', 'C', 2, 1400]), obj50(1001)]);
  expect(r).toEqual([1, 2, 4, 501]);
});
