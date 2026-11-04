// Formulaire de réservation de vol : ouverture au centre, liens aller simple et aller-retour, options, fermeture.
const { serveur, navigateur, ouvrirApplication, verifier } = require('./outils');
module.exports = async function () {
  const s = await serveur(), { b, page, erreurs } = await navigateur();
  try {
    await ouvrirApplication(page, s.port);
    await page.click('#outilvol'); await page.waitForTimeout(600);
    const bx = await page.locator('#vols').boundingBox(), v = page.viewportSize();
    verifier(Math.abs(bx.x + bx.width / 2 - v.width / 2) < 4 && Math.abs(bx.y + bx.height / 2 - v.height / 2) < 4, 'formulaire centré');
    await page.selectOption('#volsde', 'par'); await page.selectOption('#volsvers', 'nyc'); await page.fill('#volsdate', '2026-12-04');
    await page.click('#vdplus'); await page.click('.vd-classe button[data-classe="business"]'); await page.check('#volsdirects'); await page.waitForTimeout(200);
    const lien = async id => decodeURIComponent(await page.getAttribute('#lienvol' + id, 'href'));
    verifier((await lien('gf')) === 'https://www.google.com/travel/flights?hl=fr&q=Flights from PAR to NYC on 2026-12-04 nonstop for 2 adults business class', 'Google Flights, aller simple : ' + await lien('gf'));
    verifier((await lien('sk')).includes('/par/nyc/261204/?adultsv2=2&cabinclass=business&preferdirects=true'), 'Skyscanner : ' + await lien('sk'));
    await page.click('.vd-trip button[data-trip="retour"]'); await page.fill('#volsretour', '2026-12-14'); await page.press('#volsretour', 'Tab'); await page.waitForTimeout(200);
    verifier((await lien('gf')).includes('returning 2026-12-14'), 'Google Flights, aller-retour');
    verifier((await lien('sk')).includes('/261204/261214/'), 'Skyscanner, aller-retour');
    verifier((await lien('ky')).includes('/2026-12-04/2026-12-14/2adults'), 'Kayak, aller-retour');
    verifier((await lien('ex')).includes('trip=roundtrip') && (await lien('ex')).includes('leg2=from:NYC,to:PAR,departure:12/14/2026'), 'Expedia, aller-retour');
    verifier(!(await page.locator('#volschercher').isVisible()), 'recherche par connecteurs masquée hors de Claude');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    verifier(await page.evaluate(() => document.getElementById('vols').hidden), 'Échap ferme le formulaire');
    verifier(erreurs.length === 0, 'aucune erreur de page : ' + erreurs.join(' ; '));
  } finally { await b.close(); s.fermer(); }
};
