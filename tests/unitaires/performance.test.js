// Micro-benchmarks avec budgets larges (machine lente tolérée) : détectent une régression d'ordre de grandeur.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const P = require('../../src/js/purs.js');
const racine = path.join(__dirname, '../..');
function mesurer(f, n) { f(); const t = process.hrtime.bigint(); for (let i = 0; i < n; i++) f(); return Number(process.hrtime.bigint() - t) / 1e6 / n; }

test('chargement + décompression de l\'index Overture < 400 ms', () => {
  const t = Date.now(), idx = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(racine, 'data/index_overture.json.wasm'))));
  const d = Date.now() - t; console.log('  index : ' + d + ' ms');
  assert.ok(d < 400, d + ' ms'); assert.ok(idx.building && idx.segment);
});

test('groupesTouches sur l\'index réel < 50 ms par requête', () => {
  const idx = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(racine, 'data/index_overture.json.wasm'))));
  const W = [2.30, 48.84, 2.40, 48.88];
  const ms = mesurer(() => { for (const k of Object.keys(idx)) if (idx[k].f) P.groupesTouches(idx[k].f, W); }, 20);
  console.log('  groupesTouches (toutes les couches) : ' + ms.toFixed(2) + ' ms');
  assert.ok(ms < 50, ms + ' ms');
});

test('fusionnerPlages sur 100 000 plages < 500 ms', () => {
  const pl = []; for (let i = 0; i < 100000; i++) pl.push({ a: (i * 7919) % 5e8, b: ((i * 7919) % 5e8) + 4000 });
  const t = Date.now(), g = P.fusionnerPlages(pl, 196608), d = Date.now() - t;
  console.log('  fusionnerPlages 100k : ' + d + ' ms, ' + g.length + ' groupes');
  assert.ok(d < 500, d + ' ms'); assert.equal(g.reduce((s, x) => s + x.items.length, 0), 100000);
});

test('encoderLigne : 100 000 lignes de 20 points < 1 s', () => {
  const l = []; for (let i = 0; i < 20; i++) l.push([2 + i * 1e-4, 48 + i * 1e-4]);
  const t = Date.now(); for (let i = 0; i < 100000; i++) P.encoderLigne(l); const d = Date.now() - t;
  console.log('  encoderLigne 100k : ' + d + ' ms'); assert.ok(d < 1000, d + ' ms');
});

test('recherche dans 25 000 villes < 30 ms par frappe', () => {
  const v = JSON.parse(fs.readFileSync(path.join(racine, 'data/villes_20k.json'), 'utf8')), noms = v.map(x => P.normaliser(x[0]));
  const ms = mesurer(() => { const q = 'new'; let n = 0; for (let i = 0; i < noms.length; i++) if (noms[i].indexOf(q) >= 0) n++; return n; }, 50);
  console.log('  recherche ' + v.length + ' villes : ' + ms.toFixed(2) + ' ms'); assert.ok(ms < 30, ms + ' ms');
});

test('hash8 : 200 000 empreintes < 500 ms', () => {
  const t = Date.now(); for (let i = 0; i < 200000; i++) P.hash8('lieu-' + i); const d = Date.now() - t;
  console.log('  hash8 200k : ' + d + ' ms'); assert.ok(d < 500, d + ' ms');
});
