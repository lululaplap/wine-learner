// Every place a wine is chosen uses the searchable picker, never a dropdown of every wine.
const { chromium, devices } = require('playwright');
(async () => {
  let failed = false;
  const url = 'file://' + require('path').resolve(__dirname, '../dist/wine-app.html'), b = await chromium.launch();
  for (const [dev, opts] of [['laptop', { viewport: { width: 1280, height: 860 } }], ['phone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opts), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const out = (...a) => console.log(dev, ...a), go = async h => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(120); };
    const tap = async sel => (opts.hasTouch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    const check = (ok, what) => { if (!ok) { failed = true; out('FAIL', what); } };
    await p.goto(url); await tap('[data-signin]'); await tap('[data-as="both"]'); await p.waitForTimeout(120);
    for (const h of ['#edit-wine', '#pairings', '#lightspeed', '#delivery', '#take-off', '#add-wine', '#stock-take']) {
      await go(h); const big = await p.$$eval('#view select', ss => ss.filter(s => s.options.length > 20).length); check(big === 0, h + ' has a long dropdown');
    }
    // edit a wine: change, search with accents and a grape, Enter picks
    await go('#edit-wine'); await tap('[data-wpick-change="editwine"]'); await p.fill('[data-wpick-q="editwine"]', 'cosse fronsac'); await p.waitForTimeout(50);
    out('edit search "cosse fronsac":', await p.locator('#wpl-editwine [data-wpick-opt]').count(), 'result(s)');
    await p.fill('[data-wpick-q="editwine"]', 'blaufrankisch'); await p.waitForTimeout(50); const n = await p.locator('#wpl-editwine [data-wpick-opt]').count();
    out('edit search "blaufrankisch" (no accent):', n); check(n > 0, 'grape search without accent');
    await p.press('[data-wpick-q="editwine"]', 'Enter'); await p.waitForTimeout(80);
    out('editing now:', await p.locator('.wpick.chosen b').first().innerText(), '| cuvée field:', await p.inputValue('#fCuvee'));
    // pairings: suggestions before typing, then pick one
    await go('#pairings'); if (await p.locator('[data-pmode="tracked"][aria-pressed="false"]').count()) await tap('[data-pmode="tracked"]');
    await tap('[data-wpick-change="pc4"]'); out('pairing suggestions:', await p.locator('#wpl-pc4 [data-wpick-opt]').count());
    await tap('#wpl-pc4 [data-wpick-opt]'); out('toast:', await p.locator('.toast span').innerText(), '| main course now:', await p.locator('.wpick.chosen b').nth(4).innerText());
    // lightspeed: the item name is searched for you
    await go('#lightspeed'); await tap('[data-lslink="3"]');
    out('lightspeed "Fronsac Mag Btl" prefilled:', await p.inputValue('[data-wpick-q="ls3"]'), '→', await p.locator('#wpl-ls3 [data-wpick-opt]').count(), 'match(es); Link enabled:', await p.locator('[data-lsdo="3"]').isEnabled());
    await tap('#wpl-ls3 [data-wpick-opt]'); out('Link enabled after pick:', await p.locator('[data-lsdo="3"]').isEnabled()); await tap('[data-lsdo="3"]'); out(await p.locator('.toast span').innerText());
    await tap('[data-lslink="0"]'); out('no match text:', (await p.locator('#wpl-ls0').innerText()).slice(0, 80));
    // delivery: add two wines in a row, the search stays open
    await go('#delivery'); const before = await p.locator('[data-dqty]').count();
    await p.fill('[data-wpick-q="dadd"]', 'riesling'); await tap('#wpl-dadd [data-wpick-opt]'); await p.fill('[data-wpick-q="dadd"]', 'champagne'); await tap('#wpl-dadd [data-wpick-opt]');
    const after = await p.locator('[data-dqty]').count(); out('delivery lines', before, '→', after); check(after === before + 2, 'delivery adds');
    // take off stock: grape search
    await go('#take-off'); await p.fill('#tkSearch', 'nebbiolo'); await p.waitForTimeout(80); out('take-off "nebbiolo":', await p.locator('[data-pick]').count());
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); check(sw <= 0, 'no sideways scroll');
    for (const h of ['#pairings', '#lightspeed', '#edit-wine']) { await go(h); const s2 = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); check(s2 <= 0, 'sideways scroll on ' + h); }
    out('errors', errs); if (errs.length) failed = true;
    await ctx.close();
  }
  await b.close(); process.exit(failed ? 1 : 0);
})();
