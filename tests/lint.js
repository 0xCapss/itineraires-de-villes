// Analyse statique du code : assemble les fichiers du script principal dans leur fonction englobante, puis lance ESLint.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const racine = path.join(__dirname, '..');
const ordre = ['core', 'vols-liens', 'lieux-et-relief', 'generation-villes'];
const principal = '(function(){\n"use strict";\n' + ordre.map(n => fs.readFileSync(path.join(racine, 'src/js/' + n + '.js'), 'utf8')).join('') + '})();\n';
const dossier = path.join(racine, '.lint-tmp'); fs.rmSync(dossier, { recursive: true, force: true }); fs.mkdirSync(dossier);
fs.writeFileSync(path.join(dossier, 'principal.js'), principal);
['purs', 'boite-a-outils', 'formulaire-vol'].forEach(n => fs.copyFileSync(path.join(racine, 'src/js/' + n + '.js'), path.join(dossier, n + '.js')));
try {
  const sortie = execFileSync('npx', ['eslint', '-f', 'json', '.lint-tmp'], { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  rapport(JSON.parse(sortie));
} catch (e) { if (e.stdout) rapport(JSON.parse(e.stdout)); else throw e; }
function rapport(r) {
  fs.rmSync(dossier, { recursive: true, force: true });
  let erreurs = 0, avert = 0; const detail = [];
  r.forEach(f => f.messages.forEach(m => { if (m.severity === 2) erreurs++; else avert++; detail.push(path.basename(f.filePath) + ':' + m.line + ' ' + (m.severity === 2 ? 'ERREUR' : 'avert') + ' ' + m.ruleId + ' ' + m.message); }));
  if (process.argv.includes('--detail')) console.log(detail.join('\n'));
  console.log('erreurs:', erreurs, '| avertissements:', avert);
  process.exit(erreurs ? 1 : 0);
}
