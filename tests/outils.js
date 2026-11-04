// Aides communes aux tests : serveur statique sur la racine du dépôt, navigateur, attentes.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

function serveur() {
  return new Promise(ok => {
    const s = http.createServer((q, r) => {
      let p = path.join(RACINE, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
      fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
    });
    s.listen(0, () => ok({ port: s.address().port, fermer: () => s.close() }));
  });
}

async function navigateur(options = {}) {
  const opts = { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] };
  const px = process.env.HTTPS_PROXY;   // les données de génération viennent de amazonaws.com : passe par le proxy s'il y en a un
  if (px) { const u = new URL(px); opts.proxy = { server: u.protocol + '//' + u.host, bypass: '127.0.0.1,localhost' }; if (u.username) { opts.proxy.username = decodeURIComponent(u.username); opts.proxy.password = decodeURIComponent(u.password); } }
  const b = await chromium.launch(opts);
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, ignoreHTTPSErrors: !!px, acceptDownloads: true, ...options });
  const page = await ctx.newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  return { b, ctx, page, erreurs };
}

async function ouvrirApplication(page, port) {
  await page.goto('http://127.0.0.1:' + port + '/index.html');
  await page.waitForFunction(() => document.getElementById('etat').hidden, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

function verifier(condition, message) { if (!condition) throw new Error('Échec : ' + message); }
module.exports = { serveur, navigateur, ouvrirApplication, verifier, RACINE };
