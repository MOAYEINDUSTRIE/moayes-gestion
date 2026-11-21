// Atelier des livrables : chaque prestation des 5 métiers va jusqu'au livrable remis et signé.
const { test, expect } = require('@playwright/test');
const { ouvrir, entrer, texte, sansErreur } = require('./outils');

test.beforeEach(async ({ page }) => { page.erreurs = await ouvrir(page); await entrer(page);
  await page.evaluate(() => { if (document.querySelector('.modal-bg')) closeModal(); put('clients', { id: 'C1', nom: 'Mairie fictive' }); put('missions', { id: 'M1', titre: 'Audit fictif', clientId: 'C1', statut: 'en_cours', avancement: 0 }); }); });
test.afterEach(async ({ page }) => { await sansErreur(page.erreurs); });

test('chaque prestation du catalogue a sa méthode complète', async ({ page }) => {
  const r = await page.evaluate(() => DATA.catalogue.filter(p => p.cat !== MA).map(p => { const me = methode(p);
    return { code: p.code, type: me.type, etapes: prodEtapes(me).length, champs: me.champs.length, plan: me.plan.length, livrable: me.livrable }; }));
  expect(r.length).toBe(40);
  for (const x of r) {
    expect(x.etapes, x.code).toBeGreaterThanOrEqual(8);
    expect(x.champs, x.code).toBeGreaterThanOrEqual(2);
    if (!['electoral', 'reseau'].includes(x.type)) expect(x.plan, x.code).toBeGreaterThanOrEqual(3);
  }
  expect(new Set(r.map(x => x.type))).toEqual(new Set(['electoral', 'reseau', 'formation', 'accompagnement', 'strategie', 'audit', 'etude', 'structure', 'creation', 'evenement', 'presse']));
});

test('audit de communication : étapes, grille, scores, demande ATLAS, Word, PDF, procès-verbal', async ({ page, context }) => {
  await page.evaluate(() => prodDemarrer('M1', 'P-CON-04'));
  await expect(page.locator('main')).toContainText('Rapport d\'audit de communication');
  await page.locator('main input[type=checkbox]').first().check();
  await page.waitForFunction(() => get('missions', 'M1').avancement > 0);
  const r = await page.evaluate(() => {
    prodMaj('M1', x => { x.ch.contexte = 'Demande de la mairie fictive'; x.gr = { '0_0': 4, '0_1': 3, '1_0': 1, '1_1': 0, '4_0': 2 }; x.gc = { '1_1': 'Aucune charte' }; }, null, true);
    const S = prodScores(get('missions', 'M1').prod, methode(get('catalogue', 'P-CON-04')).grille);
    return { S: { ax0: S.ax[0].pct, ax1: S.ax[1].pct, ax4: S.ax[4].pct, glob: S.glob, forces: S.forces.length, faibles: S.faibles.length, saisis: S.saisis }, prompt: promptAtlas('M1') };
  });
  expect(r.S).toEqual({ ax0: 88, ax1: 13, ax4: 50, glob: 50, forces: 2, faibles: 2, saisis: 5 });
  expect(r.prompt).toContain('N\'invente aucun chiffre');
  expect(r.prompt).toContain('## ');
  expect(r.prompt).toContain('Demande de la mairie fictive');
  expect(r.prompt).toContain('Aucune charte');
  expect(r.prompt).toContain('Score global : 50 %');
  // texte rédigé collé
  const txt = '## Résumé pour la direction\nLa communication est **à renforcer**.\n## Recommandations et plan d\'action\n| Action | Priorité |\n|---|---|\n| Créer une charte | Haute |\n- Désigner un responsable';
  const mod = await page.evaluate(t => { prodMaj('M1', x => { x.tx = t; }, null, true); return prodModele('M1').M.map(b => b.t); }, txt);
  expect(mod).toEqual(['cover', 'h1', 'p', 'h1', 'table', 'ul', 'h1', 'p', 'box', 'bars', 'table']);
  const docx = await page.evaluate(() => { let b; const o = saveBinary; saveBinary = (n, m, x) => { b = [n, x.length, x[0], x[1]]; }; prodWord('M1'); saveBinary = o; return b; });
  expect(docx[0]).toBe('Rapport d\'audit de communication — Mairie fictive.docx');
  expect(docx.slice(2)).toEqual([0x50, 0x4b]);
  for (const [f, attendu] of [['prodPDF', 'La communication est à renforcer'], ['prodPV', 'Procès-verbal de livraison']]) {
    const [pop] = await Promise.all([context.waitForEvent('page'), page.evaluate(f => window[f]('M1'), f)]);
    await pop.waitForLoadState(); const t = texte(await pop.content());
    expect(t).toContain(attendu); expect(t).toContain('Mairie fictive'); expect(t).not.toMatch(/\bIA\b|ATLAS/);
    await pop.close();
  }
});

test('un texte qui mentionne l\'IA est refusé à l\'export', async ({ page }) => {
  const r = await page.evaluate(() => { prodDemarrer('M1', 'P-COM-01'); prodMaj('M1', x => { x.tx = '## Résumé\nRédigé avec l\'IA.'; }, null, true);
    let appele = false; const o = saveBinary; saveBinary = () => { appele = true; }; prodWord('M1'); saveBinary = o; return appele; });
  expect(r).toBe(false);
  await expect(page.locator('main')).toContainText('mot à retirer');
});

test('prestation électorale : le livrable renvoie à la page Stratégie', async ({ page }) => {
  await page.evaluate(() => prodDemarrer('M1', 'P-ELE-01'));
  await expect(page.locator('main')).toContainText('Ouvrir la page Stratégie');
});
