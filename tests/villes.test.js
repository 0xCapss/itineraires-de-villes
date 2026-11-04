// Parcours des 13 villes préparées : chacune s'affiche sans erreur de page.
const { serveur, navigateur, ouvrirApplication, verifier } = require('./outils');
module.exports = async function () {
  const s = await serveur(), { b, page, erreurs } = await navigateur();
  try {
    await ouvrirApplication(page, s.port);
    const valeurs = await page.evaluate(() => [...document.querySelectorAll('#ville option')].map(o => o.value).filter(v => v && !/^__|^gen/i.test(v)));
    verifier(valeurs.length >= 13, 'au moins 13 villes (obtenu ' + valeurs.length + ')');
    for (const v of valeurs.slice(0, 13)) {
      const t0 = Date.now();
      await page.selectOption('#ville', v);
      await page.waitForFunction(() => document.getElementById('etat').hidden, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(500);
      const titre = await page.evaluate(() => document.getElementById('ville').selectedOptions[0].textContent);
      console.log('  ' + titre + ' : ' + (Date.now() - t0) + ' ms');
      verifier(erreurs.length === 0, 'erreur de page sur ' + v + ' : ' + erreurs.join(' ; '));
    }
  } finally { await b.close(); s.fermer(); }
};
