// Boîte à outils des activités : tuiles par type, filtre, création d'une activité sur la carte.
const { serveur, navigateur, ouvrirApplication, verifier } = require('./outils');
module.exports = async function () {
  const s = await serveur(), { b, page, erreurs } = await navigateur();
  try {
    await ouvrirApplication(page, s.port);
    await page.selectOption('#ville', 'mem'); await page.waitForTimeout(4500);
    await page.click('#outilact'); await page.waitForTimeout(4500);
    const tuiles = await page.locator('#tuiles button').count();
    verifier(tuiles === 8, '8 tuiles d\'activités (obtenu ' + tuiles + ')');
    await page.click('#tuiles button[data-grp="musee"]'); await page.waitForTimeout(800);
    const premier = await page.evaluate(() => document.querySelector('#resultats li').innerText);
    verifier(/mus[ée]e|museum/i.test(premier), 'le filtre « Musées » ramène des musées : ' + premier.slice(0, 60));
    await page.click('#tuiles button[data-grp="musee"]');
    await page.click('#creer button[data-creer="cafe"]');
    const box = await page.locator('#carte').boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(500);
    verifier(await page.evaluate(() => !document.getElementById('formpose').hidden), 'la fiche de création s\'ouvre après un clic sur la carte');
    await page.fill('#pnom', 'Café de test'); await page.fill('#pdep', '6'); await page.click('#formpose button[type=submit]'); await page.waitForTimeout(2000);
    const etapes = await page.evaluate(() => [...document.querySelectorAll('#etapes > li.etape')].map(l => l.innerText.replace(/\s+/g, ' ')));
    verifier(etapes.length === 1 && /Café de test/.test(etapes[0]) && /Café ou bar/.test(etapes[0]), 'étape créée : ' + etapes.join(' | ').slice(0, 80));
    verifier(erreurs.length === 0, 'aucune erreur de page : ' + erreurs.join(' ; '));
  } finally { await b.close(); s.fermer(); }
};
