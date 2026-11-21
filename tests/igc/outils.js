// Outils communs aux tests : page isolée d'internet (aucune écriture possible dans la vraie base Firebase),
// relevé des erreurs JavaScript, connexion avec le code PIN de départ d'un appareil neuf.
const { expect } = require('@playwright/test');

async function ouvrir(page, { donnees = false } = {}) {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(String(e)));
  await page.route(u => !u.hostname || !['localhost', '127.0.0.1'].includes(u.hostname), r => r.abort());
  await page.goto('index.html');
  await page.waitForFunction(() => typeof DATA === 'object' && typeof pinKey === 'function');
  if (donnees) {
    await page.evaluate(() => { chargeElec(); chargeLV(); });
    await page.waitForFunction(() => typeof ELEC === 'object' && ELEC && ELEC.T && typeof LV === 'object' && LV && LV.L, null, { timeout: 60_000 });
  }
  return erreurs;
}

async function entrer(page, role = 'gerant', pin = '1234') {
  await page.evaluate(([r, p]) => { PINROLE = r; PIN = p; return pinKey('OK'); }, [role, pin]);
  await page.waitForFunction(() => !!SESSION);
  await page.evaluate(() => { if (document.querySelector('.modal-bg')) closeModal(); });
}

const texte = html => String(html).replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const indexDe = (page, re, type) => page.evaluate(([s, t]) => ELEC.T.findIndex(x => new RegExp(s, 'i').test(elNorm(x[4])) && TY(x[0]) === t), [re, type]);

async function sansErreur(erreurs) { expect(erreurs, 'erreurs JavaScript').toEqual([]); }

module.exports = { ouvrir, entrer, texte, indexDe, sansErreur };
