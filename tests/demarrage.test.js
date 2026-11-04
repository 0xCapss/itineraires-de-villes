// L'application démarre sans erreur, avec les 13 villes préparées, la boîte à outils et un en-tête clair même si le système est en mode sombre.
const { serveur, navigateur, ouvrirApplication, verifier } = require('./outils');
module.exports = async function () {
  const s = await serveur(), { b, page, erreurs } = await navigateur({ colorScheme: 'dark' });
  try {
    await ouvrirApplication(page, s.port);
    const villes = await page.evaluate(() => [...document.querySelectorAll('#ville option')].map(o => o.textContent));
    verifier(villes.length === 14 && villes[villes.length - 1] === 'Générer une ville…', '13 villes préparées plus « Générer une ville… » (obtenu : ' + villes.length + ')');
    const outils = await page.evaluate(() => [...document.querySelectorAll('.outil strong')].map(x => x.textContent));
    verifier(outils.join('|') === 'Réservation vol|Activités', 'boîte à outils : ' + outils.join('|'));
    const fond = await page.evaluate(() => getComputedStyle(document.querySelector('.cartouche')).backgroundColor);
    verifier(fond === 'rgb(255, 255, 255)', 'en-tête clair malgré le mode sombre du système (obtenu ' + fond + ')');
    verifier(await page.locator('#odgen').isVisible(), 'bouton « Générer une ville » visible');
    verifier(erreurs.length === 0, 'aucune erreur de page : ' + erreurs.join(' ; '));
  } finally { await b.close(); s.fermer(); }
};
