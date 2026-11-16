// Signs in as each example account and opens every screen it can reach, reporting any page error.
const { chromium } = require('playwright');
(async () => {
  const url = 'file://' + require('path').resolve(__dirname, '../dist/wine-app.html');
  let failed = false; const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForSelector('.guestpage');
  for (const acct of ['sam', 'tablet', 'sommelier', 'manager', 'both']) {
    await p.click('[data-signin]'); await p.click(`[data-as="${acct}"]`); await p.waitForTimeout(150);
    const links = await p.$$eval('#nav a', as => as.map(a => a.getAttribute('href')));
    console.log(acct, 'home:', await p.locator('#title').innerText(), '| nav:', links.length, '| areas:', (await p.$$eval('#nav .areahead', x => x.map(e => e.textContent))).join(','));
    for (const h of links.concat(['#/wine/gili-villo', '#/lesson/open'])) {
      await p.goto(url + h).catch(() => {}); await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(h.includes('regions') || h.includes('map') ? 700 : 120);
      const n = errs.length; if (n) { console.log('  ERR at', h, errs.splice(0)); }
    }
    await p.evaluate(() => location.hash = '#me'); await p.waitForTimeout(100);
    await p.click('[data-logout] >> nth=0'); await p.waitForTimeout(100);
  }
  console.log('errors left:', errs); if (errs.length) failed = true;
  await b.close();
  process.exit(failed ? 1 : 0);
})();
