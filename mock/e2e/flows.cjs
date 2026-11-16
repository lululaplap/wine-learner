// Walks the links between stock and learning as each example account, on a laptop, a phone and an iPad.
// Run after `npm run mock`:  npm run test:mock   (uses Playwright's Chromium; exits non-zero on any page error)
const { chromium, devices } = require('playwright');
(async () => {
  let failed = false;
  const url = 'file://' + require('path').resolve(__dirname, '../dist/wine-app.html'), b = await chromium.launch();
  for (const [dev, opts] of [['laptop', { viewport: { width: 1280, height: 860 } }], ['phone', devices['iPhone 13']], ['ipad', devices['iPad (gen 7) landscape']]]) {
    const ctx = await b.newContext(opts), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const tap = async sel => (opts.hasTouch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    const go = async h => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(120); };
    const out = (...a) => console.log(dev, ...a);
    const signin = async a => { await go('#me'); if (await p.locator('#view [data-logout]').count()) await tap('#view [data-logout]'); await tap('[data-signin]'); await tap(`[data-as="${a}"]`); await p.waitForTimeout(120); };
    await p.goto(url); await p.waitForSelector('.guestpage');
    out('guest: nav', await p.locator('#nav a:visible').count(), '| tabbar', await p.locator('#tabbar a:visible').count(), '| #/learn shows', (await go('#/learn'), await p.locator('#title').innerText()));
    // sommelier opens a bottle for a tasting from Team learning
    await signin('sommelier'); await go('#team');
    const target = await p.locator('[data-opentaste]').first().getAttribute('data-opentaste'); await tap('[data-opentaste]');
    out('opened for tasting:', target, '| toast:', await p.locator('.toast span').innerText());
    // Sam sees it, tastes it and sends notes
    await signin('sam'); out('Sam home:', await p.locator('#title').innerText(), '| theme', await p.evaluate(() => document.documentElement.dataset.theme));
    await go('#/learn'); out('path open list has target:', await p.locator(`.openlist a[href="#/wine/${target}"]`).count(), '| theme', await p.evaluate(() => document.documentElement.dataset.theme || 'auto'));
    await go('#/lesson/open'); await tap('[data-taste-start]');
    await tap('[data-score="acidity"][data-v="4"]'); await tap('[data-flav]'); await tap('[data-taste-done]');
    await tap('[data-copy]'); out('sent:', await p.locator('.copied').innerText());
    // off tonight from a service card
    await go('#tonight'); await tap('tr[data-card]'); out('card area:', await p.evaluate(() => document.body.dataset.area), '| stockbox', await p.locator('.stockbox').count());
    const cardId = decodeURIComponent((await p.evaluate(() => location.hash)).split('/').pop());
    await tap('.stockbox [data-offtonight]'); out('off toast:', await p.locator('.toast span').innerText());
    await go('#tonight'); out('tonight off list:', (await p.locator('.plainlist').first().innerText()).replace(/\n/g, ' | ').slice(0, 160));
    // before service skips it: run a few starts
    let seen = 0; for (let i = 0; i < 6; i++) { await go('#tonight'); await go('#/lesson/service'); const none = p.locator('[data-taste-none]'); if (await none.count()) await tap('[data-taste-none]'); const html = await p.locator('#view').innerHTML(); if (html.includes(cardId)) seen++; await go('#/learn'); }
    out('off wine appeared in before service:', seen, 'times of 6');
    // search
    await p.fill('#gq', 'nebbiolo'); await p.waitForTimeout(80); out('search hits:', await p.locator('#gres a').count()); await tap('#gres a'); out('search opened:', await p.locator('#title').innerText());
    // sommelier sees the inbox, marks tasted
    await signin('sommelier'); await go('#tastings'); out('inbox wines:', await p.locator('[data-marktasted]').count(), '| nav badge:', await p.locator('#nav a[href="#tastings"] .count').innerText().catch(() => '-'));
    const tid = await p.locator('[data-marktasted]').first().getAttribute('data-marktasted'); await tap('[data-marktasted]');
    await go('#/wine/' + tid); out('badge after tasted:', await p.locator('.badges').innerText().then(t => t.replace(/\n/g, ' ')));
    // add a wine and see it in Sam's New on the list
    await go('#add-wine'); await p.fill('#fProducer', 'Domaine Exemple'); await p.fill('#fCuvee', 'Les Essais'); await p.fill('#fPrice', '88'); await p.fill('#fGrapes', 'Chenin Blanc');
    await tap('[data-publish]'); await p.waitForTimeout(150); out('publish toast:', await p.locator('.toast span').innerText());
    await signin('sam'); await go('#/learn'); out('Sam new list:', (await p.locator('.newlist').innerText().catch(() => '-')).replace(/\n/g, ' | ').slice(0, 140));
    // the tablet: who's learning, then hand back
    await signin('tablet'); await go('#/learn'); out('tablet learn:', await p.locator('.namepick h1').innerText());
    await tap('[data-name="Kai"]'); out('picked:', await p.locator('.hello').innerText());
    await go('#tonight'); await go('#/learn'); out('after leaving Learn:', await p.locator('.namepick h1').count() ? 'asks again' : 'still signed in');
    // Before service on the tablet: it asks who is learning, then the lesson starts for them
    await go('#tonight'); await tap('#view a[href="#/lesson/service"]'); await p.waitForTimeout(120);
    const ask = await p.locator('#view h1').first().innerText(); await tap('[data-learner-name="Jo"]'); await p.waitForTimeout(120);
    const started = await p.locator('.lessonview').count();
    out('tablet before service asks:', ask, '| then starts:', started > 0); if (ask !== "Who's learning?" || !started) errs.push('tablet Before service did not start');
    await go('#take-off'); out('tablet take-off asks:', await p.locator('#view h2').first().innerText());
    // floor cannot reach office screens
    await go('#tastings'); out('tablet at #tastings shows:', await p.locator('#title').innerText());
    // horizontal scroll check
    for (const h of ['#tonight', '#/list', '#/learn', '#stock', '#/wine/gili-villo', '#me']) { await go(h); const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (sw > 0) out('HSCROLL', h, sw); }
    await signin('manager'); for (const h of ['#today', '#team', '#tastings', '#venue', '#check', '#/regions', '#/map']) { await go(h); await p.waitForTimeout(h.includes('/') ? 500 : 50); const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (sw > 0) out('HSCROLL', h, sw); }
    out('errors', errs); if (errs.length) failed = true;
    await ctx.close();
  }
  await b.close();
  process.exit(failed ? 1 : 0);
})();
