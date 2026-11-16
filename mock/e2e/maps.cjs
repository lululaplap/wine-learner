// Both maps draw inside the app frame: every wine at its own place (not stacked by a stray CSS transform),
// and on a phone the map itself gets most of the screen.
const { chromium, devices } = require('playwright');
(async () => {
  let failed = false;
  const url = 'file://' + require('path').resolve(__dirname, '../dist/wine-app.html'), b = await chromium.launch();
  for (const [dev, opts] of [['laptop', { viewport: { width: 1280, height: 860 } }], ['phone', devices['iPhone 13']], ['ipad', devices['iPad (gen 7) landscape']]]) {
    const p = await (await b.newContext(opts)).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.locator('[data-signin]').click(); await p.locator('[data-as="sam"]').click(); await p.waitForTimeout(120);
    for (const [h, sel] of [['#/map', '#map g.node'], ['#/regions', '#geo .region']]) {
      await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(1300);
      const r = await p.evaluate(s => { const ns = [...document.querySelectorAll(s)], st = document.querySelector('.stage');
        return { n: ns.length, places: new Set(ns.map(n => { const b = n.getBoundingClientRect(); return Math.round(b.x) + ',' + Math.round(b.y); })).size, stage: Math.round(st.getBoundingClientRect().height), vh: innerHeight }; }, sel);
      const ok = r.n > 50 && r.places > r.n * 0.8 && r.stage >= Math.min(300, r.vh * 0.45);
      console.log(dev, h, JSON.stringify(r), ok ? 'ok' : 'FAIL'); if (!ok) failed = true;
    }
    await p.evaluate(() => location.hash = '#/learn'); await p.waitForTimeout(150);
    const path = await p.evaluate(() => { const ns = [...document.querySelectorAll('.nodes > .node')]; return new Set(ns.map(n => Math.round(n.getBoundingClientRect().x))).size; });
    console.log(dev, 'lesson path still winds:', path > 1); if (path <= 1) failed = true;
    if (errs.length) { failed = true; console.log(dev, 'errors', errs); }
  }
  await b.close(); process.exit(failed ? 1 : 0);
})();
