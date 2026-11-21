// Étape 4 : synchronisation fiche par fiche (moayes/igc), reprise de l'ancien emplacement, appareils multiples.
const { test, expect } = require('@playwright/test');
const { ouvrir, entrer, sansErreur } = require('./outils');

const ANCIEN = { moayes: { igc_data: {
  societe: { nom: 'IMPACT GLOBAL CONSULTING', sigle: 'IGC' }, soldes: { caisse: 0, banque: 0, mobile: 0 }, compteurs: { D2026: 4 },
  _lastSaved: 1763700000000, _del: {}, _pins: {}, audit: [{ t: 1763700000000, u: 'gerant', a: 'Ancienne action' }],
  clients: [{ id: 'CL1', nom: 'Client ancien', u: 1763700000000 }], devis: [], missions: [], factures: [], paiements: [], depenses: [], ordres: [], catalogue: [], dossiers: [], comptesRendus: []
} } };
const pret = page => page.waitForFunction(() => FB_PRET === true && !DIRTY && FBST.t === 'Synchronisé', null, { timeout: 15_000 });

test('première ouverture : l\'ancien emplacement est recopié fiche par fiche, sans être effacé', async ({ page }) => {
  const erreurs = await ouvrir(page, { firebase: { arbre: ANCIEN } });
  await pret(page);
  const r = await page.evaluate(() => ({ cl: __FB.lire('moayes/igc/c/clients/CL1'), meta: __FB.lire('moayes/igc/meta'), anc: __FB.lire('moayes/igc_data/clients'), cat: Object.keys(__FB.lire('moayes/igc/c/catalogue') || {}).length, mode: FB_MODE }));
  expect(r.mode).toBe('fiches');
  expect(r.cl.nom).toBe('Client ancien');
  expect(r.meta.societe.rccm).toBe('CI-ABJ-03-2026-B12-07790');
  expect(r.meta.compteurs.D2026).toBe(4);
  expect(r.cat).toBeGreaterThanOrEqual(25);
  expect(r.anc).toBeTruthy();                        // ancien emplacement intact
  await sansErreur(erreurs);
});

test('une modification n\'envoie que la fiche modifiée', async ({ page }) => {
  const erreurs = await ouvrir(page, { firebase: { arbre: ANCIEN } });
  await entrer(page); await pret(page);
  await page.evaluate(() => { __FB.ecritures.length = 0; put('clients', { id: 'CL2', nom: 'Nouveau client' }, 'Client ajouté'); });
  await pret(page);
  const w = await page.evaluate(() => __FB.ecritures.filter(e => e.type === 'update'));
  expect(w.length).toBe(1);
  const cles = Object.keys(w[0].v);
  expect(cles).toContain('c/clients/CL2');
  expect(cles.filter(k => k.startsWith('c/'))).toEqual(['c/clients/CL2']);
  expect(w[0].octets).toBeLessThan(8000);
  expect(await page.evaluate(() => __FB.ecritures.some(e => e.p === 'moayes/igc_data'))).toBe(false);
  await sansErreur(erreurs);
});

test('les saisies d\'un autre appareil arrivent, suppressions comprises', async ({ page }) => {
  const erreurs = await ouvrir(page, { firebase: { arbre: ANCIEN } });
  await entrer(page); await pret(page);
  await page.evaluate(() => __FB.ecrire('moayes/igc/c/clients/CL9', { id: 'CL9', nom: 'Saisi au bureau', u: Date.now() + 1000 }));
  await page.waitForFunction(() => !!get('clients', 'CL9'));
  await page.evaluate(() => { __FB.ecrire('moayes/igc/del/CL9', Date.now() + 5000); __FB.ecrire('moayes/igc/c/clients/CL9', null); });
  await page.waitForFunction(() => !get('clients', 'CL9'));
  // modification plus ancienne que la version locale : ignorée
  await page.evaluate(() => __FB.ecrire('moayes/igc/c/clients/CL1', { id: 'CL1', nom: 'Vieille version', u: 1 }));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => get('clients', 'CL1').nom)).toBe('Client ancien');
  await sansErreur(erreurs);
});

test('un appareil resté en V1.32 : ses saisies sont reprises', async ({ page }) => {
  const erreurs = await ouvrir(page, { firebase: { arbre: ANCIEN } });
  await entrer(page); await pret(page);
  await page.evaluate(() => { const a = __FB.lire('moayes/igc_data'); a.clients.push({ id: 'CLV', nom: 'Saisi en V1.32', u: Date.now() + 1000 }); a._lastSaved = Date.now() + 1000; __FB.ecrire('moayes/igc_data', a); });
  await page.waitForFunction(() => !!get('clients', 'CLV'));
  await pret(page);
  expect(await page.evaluate(() => __FB.lire('moayes/igc/c/clients/CLV').nom)).toBe('Saisi en V1.32');
  await sansErreur(erreurs);
});

test('règles pas encore déployées : l\'application garde l\'ancien emplacement', async ({ page }) => {
  const erreurs = await ouvrir(page, { firebase: { arbre: ANCIEN, refus: '^moayes/igc(/|$)' } });
  await entrer(page);
  await page.waitForFunction(() => FB_MODE === 'ancien');
  await page.evaluate(() => put('clients', { id: 'CL3', nom: 'Repli' }, 'Client ajouté'));
  await page.waitForFunction(() => (__FB.lire('moayes/igc_data/clients') || []).some?.(x => x && x.id === 'CL3') || Object.values(__FB.lire('moayes/igc_data/clients') || {}).some(x => x.id === 'CL3'));
  expect(await page.evaluate(() => erreursLocales().some(e => /Nouvel emplacement refusé/.test(e.m)))).toBe(true);
  await sansErreur(erreurs);
});

test('État du système : erreurs envoyées et affichées, sans donnée nominative', async ({ page }) => {
  const erreurs = await ouvrir(page, { firebase: { arbre: ANCIEN } });
  await entrer(page); await pret(page);
  await page.evaluate(() => { setTimeout(() => { throw new Error('Panne simulée'); }, 0); });
  await page.waitForFunction(() => Object.keys(__FB.lire('moayes/igc/erreurs') || {}).length > 0);
  const e = await page.evaluate(() => Object.values(__FB.lire('moayes/igc/erreurs'))[0]);
  expect(e.m).toContain('Panne simulée');
  expect(Object.keys(e).sort()).toEqual(['app', 'g', 'id', 'm', 's', 't', 'v', 'vue']);
  await page.evaluate(() => go('systeme'));
  await expect(page.locator('main')).toContainText('Panne simulée');
  await expect(page.locator('main')).toContainText('fiche par fiche');
  expect(erreurs.filter(x => !/Panne simulée/.test(x))).toEqual([]);
});
