#!/usr/bin/env node
// Lance tous les tests : node tests/run.js [motif]
const fs = require('fs'), path = require('path');
(async () => {
  const motif = process.argv[2] || '', fichiers = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f.includes(motif)).sort();
  let echecs = 0;
  for (const f of fichiers) {
    const t0 = Date.now();
    try { await require(path.join(__dirname, f))(); console.log('OK     ' + f + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)'); }
    catch (e) { echecs++; console.log('ÉCHEC  ' + f + ' : ' + e.message); }
  }
  console.log(echecs ? echecs + ' test(s) en échec' : 'Tous les tests passent (' + fichiers.length + ')');
  process.exit(echecs ? 1 : 0);
})();
