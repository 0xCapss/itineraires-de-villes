// Budget de performance au démarrage (marges larges : rendu logiciel, machine partagée). Détecte une régression d'ordre de grandeur.
const zlib = require('zlib'), fs = require('fs'), path = require('path');
const { mesurerDemarrage } = require('./mesures');
const { verifier, RACINE } = require('./outils');
module.exports = async function () {
  const gz = Math.round(zlib.gzipSync(fs.readFileSync(path.join(RACINE, 'index.html'))).length / 1024);
  const m = await mesurerDemarrage();
  console.log('  mesures : ' + JSON.stringify(m) + ', gzip ' + gz + ' Ko');
  verifier(m.html_ko <= 700, 'index.html ' + m.html_ko + ' Ko (budget 700)');
  verifier(gz <= 250, 'index.html gzip ' + gz + ' Ko (budget 250)');
  verifier(m.dcl_ms <= 3000, 'DOMContentLoaded ' + m.dcl_ms + ' ms (budget 3000)');
  verifier(m.ville_prete_ms <= 8000, 'ville prête ' + m.ville_prete_ms + ' ms (budget 8000)');
  verifier(m.tas_mo <= 150, 'tas JavaScript ' + m.tas_mo + ' Mo (budget 150)');
  verifier(m.noeuds_dom <= 20000, 'noeuds DOM ' + m.noeuds_dom + ' (budget 20000)');
};
