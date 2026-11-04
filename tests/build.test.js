// index.html correspond bien à ce que produit build.py à partir de src/ et data/.
const { execFileSync } = require('child_process'), path = require('path');
const { verifier, RACINE } = require('./outils');
module.exports = async function () {
  let sortie = '';
  try { sortie = execFileSync('python3', [path.join(RACINE, 'build.py'), '--check'], { encoding: 'utf8' }); }
  catch (e) { verifier(false, 'index.html n\'est pas à jour : lancez « python3 build.py » (' + (e.stdout || e.message) + ')'); }
  verifier(/à jour/.test(sortie), 'verification de build');
};
