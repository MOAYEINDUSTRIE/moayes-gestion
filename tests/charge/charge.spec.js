// Test de charge sur une COPIE fictive (aucune donnée réelle, aucune connexion à la vraie base) :
// le cabinet après plusieurs années d'activité. Mesure le démarrage, chaque écran, l'enregistrement,
// la taille d'un envoi vers la base et le calcul des stratégies de toutes les régions.
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const { ouvrir, entrer } = require('../igc/outils');

const NIVEAUX = { normal: 1, fort: 3 };               // fort = trois fois le volume « normal »
const BASE = { clients: 400, devis: 1500, missions: 500, factures: 1500, paiements: 2000, depenses: 2500, dossiers: 300, comptesRendus: 200 };
const SEUILS = { ordinateur: { ecran: 1500, demarrage: 4000 }, telephone: { ecran: 3000, demarrage: 8000 } };

function copieFictive(k) {
  const n = c => BASE[c] * k, t0 = Date.UTC(2022, 0, 1), j = i => new Date(t0 + i * 864e5 % (4 * 365 * 864e5)).toISOString().slice(0, 10);
  const lig = i => [{ d: 'Prestation fictive ' + (i % 25), q: 1 + i % 3, pu: 100000 + (i % 40) * 25000 }, { d: 'Frais', q: 1, pu: 50000 }];
  const d = { societe: { nom: 'IMPACT GLOBAL CONSULTING', sigle: 'IGC' }, soldes: { caisse: 0, banque: 0, mobile: 0, date: '2026-01-01' }, compteurs: {}, _del: {}, _pins: {}, audit: [], _lastSaved: 1, nonRes: {}, ordres: [], catalogue: [] };
  d.clients = Array.from({ length: n('clients') }, (_, i) => ({ id: 'C' + i, nom: 'Client fictif ' + i, type: 'Entreprise', tel: '', email: '', u: 1 }));
  d.devis = Array.from({ length: n('devis') }, (_, i) => ({ id: 'D' + i, num: 'IGC-D-T-' + i, clientId: 'C' + (i % n('clients')), date: j(i), objet: 'Mission fictive ' + i, lignes: lig(i), statut: ['brouillon', 'envoye', 'accepte', 'refuse'][i % 4], u: 1 }));
  d.missions = Array.from({ length: n('missions') }, (_, i) => ({ id: 'M' + i, titre: 'Mission fictive ' + i, clientId: 'C' + (i % n('clients')), debut: j(i), statut: ['en_cours', 'terminee'][i % 2], u: 1 }));
  d.factures = Array.from({ length: n('factures') }, (_, i) => ({ id: 'F' + i, num: 'IGC-F-T-' + i, clientId: 'C' + (i % n('clients')), date: j(i), echeance: j(i + 30), objet: 'Facture fictive ' + i, lignes: lig(i), statut: 'emise', u: 1 }));
  d.paiements = Array.from({ length: n('paiements') }, (_, i) => ({ id: 'P' + i, factureId: 'F' + (i % n('factures')), date: j(i + 10), montant: 50000 + (i % 20) * 10000, mode: 'Virement', u: 1 }));
  d.depenses = Array.from({ length: n('depenses') }, (_, i) => ({ id: 'X' + i, date: j(i), cat: ['Transport', 'Communication', 'Loyer', 'Fournitures'][i % 4], desc: 'Dépense fictive ' + i, montant: 5000 + (i % 50) * 1000, mode: 'Espèces', u: 1 }));
  d.dossiers = Array.from({ length: n('dossiers') }, (_, i) => ({ id: 'Z' + i, nom: 'Dossier fictif ' + i, clientId: 'C' + (i % n('clients')), u: 1 }));
  d.comptesRendus = Array.from({ length: n('comptesRendus') }, (_, i) => ({ id: 'R' + i, date: j(i), titre: 'Réunion fictive ' + i, texte: 'Compte rendu fictif. '.repeat(20), u: 1 }));
  return d;
}

for (const [niveau, k] of Object.entries(NIVEAUX)) {
  test(`charge ${niveau} (×${k})`, async ({ page }, info) => {
    test.setTimeout(300_000);
    const appareil = info.project.name, seuil = SEUILS[appareil];
    if (appareil === 'telephone') { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    const copie = copieFictive(k), json = JSON.stringify(copie);
    const vues = ['tableau', 'clients', 'devis', 'missions', 'factures', 'paiements', 'depenses', 'tresorerie', 'rapports', 'dossiers', 'comptesRendus', 'catalogue', 'systeme'];
    await ouvrir(page, { firebase: { arbre: {} }, avant: [s => { if (!sessionStorage.getItem('copie')) { sessionStorage.setItem('copie', 1); try { localStorage.setItem('igc_gestion_v1', s); } catch (e) { window.__QUOTA = String(e); } } }, json] });
    const quota = await page.evaluate(() => window.__QUOTA || '');
    await entrer(page);
    await page.waitForFunction(() => FB_PRET === true, null, { timeout: 120_000 });
    const R = await page.evaluate(async vues => {
      const r = { fiches: COLS.reduce((s, c) => s + DATA[c].length, 0), taille: JSON.stringify(DATA).length, demarrage: MESURES.pret, ecrans: {} };
      for (const v of vues) { const t = performance.now(); go(v); r.ecrans[v] = Math.round(performance.now() - t); }
      let t = performance.now(); save(); r.enregistrement = Math.round(performance.now() - t);
      await new Promise(ok => { const w = () => (!DIRTY ? ok() : setTimeout(w, 100)); setTimeout(w, 700); });
      __FB.ecritures.length = 0;
      t = performance.now(); put('clients', { id: 'CNEW', nom: 'Nouveau client' }, 'Client ajouté'); envoyerV2(); r.calculEnvoi = Math.round(performance.now() - t);
      await new Promise(ok => setTimeout(ok, 300));
      const w = __FB.ecritures.filter(e => e.type === 'update'); r.envoiUneFiche = w.length ? w[w.length - 1].octets : 0;
      r.ancienEnvoi = JSON.stringify(DATA).length;     // ce qu'envoyait la V1.32 à chaque modification
      r.memoire = (() => { try { return localStorage.getItem('igc_gestion_v1').length; } catch (e) { return 0; } })();
      return r;
    }, vues);
    R.quota = quota;
    // stratégie de toutes les régions (base CEI réelle, lecture seule)
    await page.evaluate(() => { chargeElec(); chargeLV(); });
    await page.waitForFunction(() => typeof ELEC === 'object' && ELEC && ELEC.T && typeof LV === 'object' && LV && LV.L, null, { timeout: 120_000 });
    Object.assign(R, await page.evaluate(() => { const ids = ELEC.T.map((x, i) => TY(x[0]) === 3 ? i : -1).filter(i => i >= 0); const t = performance.now(); ids.forEach(i => { stratData(i); etudeModele(i); }); return { regions: ids.length, strategies: Math.round(performance.now() - t) }; }));
    R.appareil = appareil; R.niveau = niveau; R.seuils = seuil;
    const dir = path.join(__dirname, '..', 'rapport-charge'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${appareil}-${niveau}.json`), JSON.stringify(R, null, 1));
    const lent = Object.entries(R.ecrans).filter(([, ms]) => ms > seuil.ecran);
    const md = [`### Charge ${niveau} (×${k}) — ${appareil}${appareil === 'telephone' ? ' (processeur ralenti ×4)' : ''}`,
      `| Mesure | Valeur | Seuil |`, `|---|---|---|`,
      `| Fiches | ${R.fiches.toLocaleString('fr-FR')} (${(R.taille / 1048576).toFixed(1)} Mo) | — |`,
      `| Copie sur l'appareil | ${R.quota ? '❌ trop grosse pour le navigateur' : (R.memoire / 1e6).toFixed(1) + ' M caractères' + (R.memoire > 3e6 ? ' ⚠️' : '')} | ≈ 5 M caractères |`,
      `| Démarrage | ${R.demarrage} ms | ${seuil.demarrage} ms |`,
      ...Object.entries(R.ecrans).map(([v, ms]) => `| Écran ${v} | ${ms} ms ${ms > seuil.ecran ? '⚠️' : ''} | ${seuil.ecran} ms |`),
      `| Enregistrement local | ${R.enregistrement} ms | — |`,
      `| Envoi d'une modification (V1.33) | ${(R.envoiUneFiche / 1024).toFixed(1)} Ko, calcul ${R.calculEnvoi} ms | — |`,
      `| Même modification en V1.32 | ${(R.ancienEnvoi / 1024).toFixed(0)} Ko | — |`,
      `| Stratégies des ${R.regions} régions | ${R.strategies} ms | — |`, ''].join('\n');
    fs.writeFileSync(path.join(dir, `${appareil}-${niveau}.md`), md);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
    console.log(md);
    if (niveau === 'normal') {
      expect(R.quota, 'la copie doit tenir sur l\'appareil').toBe('');
      expect(lent, 'écrans trop lents').toEqual([]);
      expect(R.envoiUneFiche).toBeLessThan(10_000);
    }
  });
}
