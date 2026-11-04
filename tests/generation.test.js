// Génération d'une ville à la demande (demande l'accès à amazonaws.com ; ignoré avec SANS_RESEAU=1) et historique de 10 villes.
const { serveur, navigateur, ouvrirApplication, verifier } = require('./outils');
module.exports = async function () {
  if (process.env.SANS_RESEAU) { console.log('  (ignoré : SANS_RESEAU=1)'); return; }
  const s = await serveur(), { b, page, erreurs } = await navigateur();
  try {
    await ouvrirApplication(page, s.port);
    await page.click('#odgen'); await page.fill('#odq', 'mexico'); await page.uncheck('#odparcs');
    const t0 = Date.now(); await page.press('#odq', 'Enter');
    await page.waitForFunction(() => document.getElementById('odmodal').hidden, null, { timeout: 180000 });
    await page.waitForFunction(() => document.getElementById('etat').hidden, null, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(3000);
    const duree = (Date.now() - t0) / 1000;
    verifier(duree < 90, 'génération de Mexico en moins de 90 s (obtenu ' + duree.toFixed(1) + ' s)');
    verifier((await page.evaluate(() => document.getElementById('ville').selectedOptions[0].textContent)) === 'Mexico', 'la ville générée est sélectionnée dans la liste');
    await page.waitForTimeout(15000);
    const d = await page.evaluate(() => window.__odDbg());
    verifier(d.charge === 9 && d.quartiers > 0 && d.lieux > 1000, 'cellules voisines, quartiers et lieux chargés : ' + JSON.stringify(d));
    await page.click('#outilact'); await page.waitForTimeout(5000);
    verifier((await page.locator('#tuiles button').count()) === 8, 'tuiles d\'activités sur la ville générée');
    // historique : 12 villes factices -> 10 générées au plus, conservées après rechargement
    const n = await page.evaluate(() => { for (let i = 0; i < 12; i++) window.__odCreer(['Ville test ' + i, 'FR', 2 + i * 0.5, 45 + i * 0.2, Date.now() + i]); return [...document.querySelectorAll('#ville option')].filter(o => o.value.indexOf('od-') === 0).length; });
    verifier(n === 10, 'historique limité à 10 villes (obtenu ' + n + ')');
    await page.reload(); await page.waitForTimeout(3500);
    const apres = await page.evaluate(() => [...document.querySelectorAll('#ville option')].filter(o => o.value.indexOf('od-') === 0).length);
    verifier(apres === 10, 'historique conservé après rechargement (obtenu ' + apres + ')');
    verifier(erreurs.length === 0, 'aucune erreur de page : ' + erreurs.join(' ; '));
  } finally { await b.close(); s.fermer(); }
};
