// On phones and narrow tablets: Before service keeps the menus, with its answer bar above the bottom bar;
// a lesson from the path opens full screen, with no menus. Laptops always keep the sidebar.
const { chromium, devices } = require('playwright');
(async () => {
  let failed = false;
  const url = 'file://' + require('path').resolve(__dirname, '../dist/wine-app.html'), b = await chromium.launch();
  for (const [dev, o] of [['phone', devices['iPhone 13']], ['ipad-portrait', devices['iPad (gen 7)']], ['laptop', { viewport: { width: 1280, height: 860 } }]]) {
    const p = await (await b.newContext(o)).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const t = s => (o.hasTouch ? p.locator(s).first().tap() : p.locator(s).first().click());
    await p.goto(url); await t('[data-signin]'); await t('[data-as="sam"]'); await p.waitForTimeout(150);
    for (const kind of ['before', 'path']) {
    if (kind === 'before') { await p.evaluate(() => location.hash = '#tonight'); await p.waitForTimeout(120); await t('#view a[href="#/lesson/service"]'); }
    else { await p.evaluate(() => location.hash = '#/learn'); await p.waitForTimeout(120); await t('#view .pathactions a.btn.big'); }
    await p.waitForTimeout(150);
    if (await p.locator('[data-taste-none]').count()) await t('[data-taste-none]');
    const shown = sel => p.evaluate(s => [...document.querySelectorAll(s)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).length, sel);
    const nav = { tabbar: await shown('#tabbar a'), chips: await shown('#mnav a'), sidebar: await shown('#nav a') };
    const wide = nav.sidebar > 0, navOk = wide || (kind === 'before' ? nav.tabbar > 0 && nav.chips > 0 : nav.tabbar === 0 && nav.chips === 0);
    // answer whatever question came up, so the answer bar shows
    if (await p.locator('[data-opt="0"]').count()) await t('[data-opt="0"]');
    else if (await p.locator('[data-reveal]').count()) await t('[data-reveal]');
    else if (await p.locator('#typedInput').count()) { await p.fill('#typedInput', 'x'); await p.press('#typedInput', 'Enter'); }
    else { const m = p.locator('[data-m]'); const n = await m.count(); for (let i = 0; i < n && !(await p.locator('.feedback').count()); i++) await m.nth(i).click().catch(() => {}); }
    await p.waitForTimeout(450); // let the answer bar finish sliding up
    const fb = await p.evaluate(() => { const f = document.querySelector('.feedback'); if (!f) return null; const tb = document.getElementById('tabbar'), shown = getComputedStyle(tb).display !== 'none';
      const btn = f.querySelector('.btn').getBoundingClientRect(); return { tabbar: shown, answerBarBottom: Math.round(f.getBoundingClientRect().bottom), tabbarTop: shown ? Math.round(tb.getBoundingClientRect().top) : null, buttonClear: btn.bottom <= (shown ? tb.getBoundingClientRect().top + 1 : innerHeight) }; });
    const ok = navOk && fb && fb.buttonClear && (!fb.tabbar || fb.answerBarBottom <= fb.tabbarTop + 1);
    console.log(dev, kind.padEnd(6), JSON.stringify(nav), JSON.stringify(fb), ok ? 'ok' : 'FAIL'); if (!ok) failed = true;
    if (await p.locator('[data-continue]').count()) await t('[data-continue]');
    }
    if (errs.length) { failed = true; console.log(dev, 'errors', errs); }
  }
  await b.close(); process.exit(failed ? 1 : 0);
})();
