// Mesures de performance au démarrage : renvoie un objet de mesures (utilisé par performance.test.js et par `node tests/mesures.js`).
const { serveur, navigateur } = require('./outils');
async function mesurerDemarrage() {
  const s = await serveur(), { b, ctx, page } = await navigateur();
  try {
    const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
    await page.addInitScript(() => { window.__tl = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__tl.push(e.duration))).observe({ entryTypes: ['longtask'] }); } catch (e) {} });
    const t0 = Date.now();
    await page.goto('http://127.0.0.1:' + s.port + '/index.html', { waitUntil: 'domcontentloaded' });
    const tDom = Date.now() - t0;
    await page.waitForFunction(() => { const e = document.getElementById('etat'); return e && e.hidden; }, null, { timeout: 90000 }).catch(() => {});
    const tPret = Date.now() - t0;
    await page.waitForTimeout(1500);
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { transfert: n.transferSize, decode: n.decodedBodySize, dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
    const tl = await page.evaluate(() => window.__tl || []);
    return { html_ko: Math.round(nav.decode / 1024), dom_ms: tDom, dcl_ms: nav.dcl, load_ms: nav.load, ville_prete_ms: tPret,
      tas_mo: Math.round(m.JSHeapUsedSize / 1048576), noeuds_dom: m.Nodes, script_ms: Math.round(m.ScriptDuration * 1000), taches_longues: tl.length, taches_longues_ms: Math.round(tl.reduce((a, b) => a + b, 0)) };
  } finally { await b.close(); s.fermer(); }
}
module.exports = { mesurerDemarrage };
if (require.main === module) (async () => { const r = []; for (let i = 0; i < 3; i++) r.push(await mesurerDemarrage()); console.log(JSON.stringify(r, null, 1)); })();
