// Tests unitaires des fonctions pures (src/js/purs.js). Lancement : node --test tests/unitaires/
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const P = require('../../src/js/purs.js');

test('normaliser retire accents et majuscules', () => {
  assert.equal(P.normaliser('Île-de-France'), 'ile-de-france');
  assert.equal(P.normaliser('São Paulo'), 'sao paulo');
  assert.equal(P.normaliser(null), '');
  assert.equal(P.normaliser(undefined), '');
});

test('slug : identifiant stable, borné à 30 caractères', () => {
  assert.equal(P.slug('São Paulo'), 'sao-paulo');
  assert.equal(P.slug('  --New  York!! '), 'new-york');
  assert.equal(P.slug('東京'), 'ville');
  assert.equal(P.slug(''), 'ville');
  assert.ok(P.slug('a'.repeat(100)).length <= 30);
});

test('hash8 : 8 caractères hexadécimaux, déterministe, sans collision sur 20 000 chaînes', () => {
  assert.match(P.hash8('abc'), /^[0-9a-f]{8}$/);
  assert.equal(P.hash8('abc'), P.hash8('abc'));
  assert.notEqual(P.hash8('abc'), P.hash8('abd'));
  const vus = new Set();
  for (let i = 0; i < 20000; i++) vus.add(P.hash8('lieu-' + i + '-' + (i * 7919 % 1000)));
  assert.ok(vus.size >= 19990, 'collisions : ' + (20000 - vus.size));
});

function decoder(f) { const pts = [[f[0] / 1e5, f[1] / 1e5]]; for (let i = 2; i < f.length; i += 2) pts.push([pts[pts.length - 1][0] + f[i] / 1e5, pts[pts.length - 1][1] + f[i + 1] / 1e5]); return pts; }

test('encoderLigne : aller-retour avec le décodage, précision 1e-5', () => {
  const co = [[2.35221, 48.85661], [2.35300, 48.85700], [2.35100, 48.85000]];
  const d = decoder(P.encoderLigne(co));
  assert.equal(d.length, 3);
  d.forEach((p, i) => { assert.ok(Math.abs(p[0] - co[i][0]) < 2e-5); assert.ok(Math.abs(p[1] - co[i][1]) < 2e-5); });
});
test('encoderLigne : fusionne les doublons consécutifs, null sous deux points', () => {
  assert.equal(P.encoderLigne([[1, 1], [1, 1], [1, 1]]), null);
  assert.equal(P.encoderLigne([[1, 1]]), null);
  assert.equal(P.encoderLigne([]), null);
  assert.equal(decoder(P.encoderLigne([[1, 1], [1, 1], [2, 2]])).length, 2);
});

test('aireM2 : carré de 0,001 degré', () => {
  const kx = 111200 * Math.cos(48 * Math.PI / 180);
  const a = P.aireM2([[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]], kx);
  assert.ok(Math.abs(a - 0.001 * kx * 0.001 * 111200) < 1);
  const inverse = P.aireM2([[0, 0], [0, 0.001], [0.001, 0.001], [0.001, 0], [0, 0]], kx);
  assert.ok(Math.abs(a - inverse) < 1e-6, 'aire toujours positive');
});

test('classeRoute : identique à la liste CLASSES de core.js', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/js/core.js'), 'utf8');
  const m = /var CLASSES=\[([^\]]+)\]/.exec(src);
  assert.deepEqual(JSON.parse('[' + m[1] + ']'), P.CLASSES_ROUTES);
  assert.equal(P.classeRoute('motorway'), 0);
  assert.equal(P.classeRoute('residential'), 5);
  assert.equal(P.classeRoute('driveway'), 7);
  assert.equal(P.classeRoute('bridleway'), 12);
  assert.equal(P.classeRoute('inconnu'), 15);
});

test('groupeLieu : catégories courantes', () => {
  const att = { hotel: 'hotel', coffee_shop: 'cafe', italian_restaurant: 'resto', museum: 'musee', castle: 'histoire', park: 'nature', cinema: 'spectacle' };
  Object.keys(att).forEach(k => assert.equal(P.groupeLieu(k), att[k], k));
  assert.equal(P.groupeLieu('dentist'), null);
  assert.equal(P.groupeLieu(null), null);
  assert.equal(P.groupeLieu('barbershop'), null, 'ne pas confondre bar et barbershop');
});

test('fusionnerPlages : regroupe selon l\'écart, trie, conserve tous les éléments', () => {
  assert.deepEqual(P.fusionnerPlages([]), []);
  const g = P.fusionnerPlages([{ a: 1000, b: 2000 }, { a: 0, b: 500 }, { a: 5000000, b: 5000100 }], 1000);
  assert.equal(g.length, 2);
  assert.deepEqual([g[0].a, g[0].b, g[0].items.length], [0, 2000, 2]);
  assert.deepEqual([g[1].a, g[1].b], [5000000, 5000100]);
  const chev = P.fusionnerPlages([{ a: 0, b: 100 }, { a: 10, b: 50 }], 0);
  assert.deepEqual([chev[0].a, chev[0].b, chev[0].items.length], [0, 100, 2], 'plage incluse : la fin ne recule pas');
  assert.equal(P.fusionnerPlages([{ a: 0, b: 1 }, { a: 196610, b: 300000 }]).length, 2, 'écart par défaut 196608');
  assert.equal(P.fusionnerPlages([{ a: 0, b: 1 }, { a: 196609, b: 300000 }]).length, 1);
});

test('groupesTouches : index synthétique', () => {
  const f = [['a.parquet', [[0, 0, 100, 100, 10], [200, 0, 300, 100, 20], [0, 200, 100, 300, 5]]], ['b.parquet', [[1000, 1000, 1100, 1100, 7]]]];
  assert.deepEqual(P.groupesTouches(f, [0.5, 0.5, 0.6, 0.6]), [['a.parquet', [[0, 10]]]]);
  assert.deepEqual(P.groupesTouches(f, [0.5, 0.5, 2.5, 0.6]), [['a.parquet', [[0, 10], [10, 30]]]]);
  assert.deepEqual(P.groupesTouches(f, [0, 2, 1, 3]), [['a.parquet', [[30, 35]]]]);
  assert.deepEqual(P.groupesTouches(f, [10.5, 10.5, 10.6, 10.6]), [['b.parquet', [[0, 7]]]]);
  assert.deepEqual(P.groupesTouches(f, [50, 50, 51, 51]), []);
});

test('construireLiensVol : les quatre sites reprennent le formulaire', () => {
  const base = { O: { liste: ['CDG', 'ORY'], un: 'CDG' }, D: { liste: ['JFK'], un: 'JFK' }, date: '2027-03-10', retour: '2027-03-20', aller_retour: true, adultes: 2, classe: 'business', direct: true, apres: '09:30', avant: '18:00' };
  const r = P.construireLiensVol(base);
  assert.equal(r.dv, true); assert.equal(r.drv, true);
  const q = decodeURIComponent(r.gf.split('q=')[1]);
  assert.equal(q, 'Flights from CDG or ORY to JFK on 2027-03-10 returning 2027-03-20 nonstop for 2 adults business class departing after 9:30 AM arriving before 6:00 PM');
  assert.equal(r.sk, 'https://www.skyscanner.fr/transport/vols/cdg/jfk/270310/270320/?adultsv2=2&cabinclass=business&preferdirects=true');
  assert.equal(r.ky, 'https://www.kayak.fr/flights/CDG,ORY-JFK/2027-03-10/2027-03-20/2adults/business?fs=stops=0');
  assert.equal(r.ex, 'https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=from:CDG,to:JFK,departure:03/10/2027TANYT&leg2=from:JFK,to:CDG,departure:03/20/2027TANYT&passengers=adults:2&mode=search&options=cabinclass:business,maxhops:0');
});
test('construireLiensVol : aller simple par défaut, retour antérieur ignoré', () => {
  const o = { liste: ['LYS'], un: 'LYS' }, d = { liste: ['BCN'], un: 'BCN' };
  const r = P.construireLiensVol({ O: o, D: d, date: '2027-05-01', retour: '2027-04-01', aller_retour: true });
  assert.equal(r.drv, false);
  assert.ok(r.ex.includes('trip=oneway') && r.ex.endsWith('&passengers=adults:1&mode=search'));
  assert.ok(r.ky.endsWith('/2027-05-01/1adults'));
  const sans = P.construireLiensVol({ O: o, D: d });
  assert.equal(sans.dv, false);
  assert.equal(decodeURIComponent(sans.gf.split('q=')[1]), 'Flights from LYS to BCN');
});
