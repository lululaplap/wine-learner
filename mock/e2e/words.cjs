// Wine words in the lessons: the Wine words lesson runs every kind of term question, a lesson from the path
// includes a word or two from its own wines, and the answer screen explains the term.
const { chromium, devices } = require('playwright');
(async () => {
  let failed = false;
  const url = 'file://' + require('path').resolve(__dirname, '../dist/wine-app.html'), b = await chromium.launch();
  for (const [dev, o] of [['laptop', { viewport: { width: 1280, height: 860 } }], ['phone', devices['iPhone 13']]]) {
    const p = await (await b.newContext(o)).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const t = s => (o.hasTouch ? p.locator(s).first().tap() : p.locator(s).first().click());
    const go = async h => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(150); };
    await p.goto(url); await t('[data-signin]'); await t('[data-as="sam"]'); await p.waitForTimeout(120);
    await go('#/learn'); const btn = await p.locator('#view a[href="#/lesson/words"]').innerText(); console.log(dev, 'path button:', btn.replace(/\s+/g, ' '));
    // answer a whole Wine words lesson, whatever the question
    const answer = async () => {
      if (await p.locator('[data-taste-none]').count()) await t('[data-taste-none]');
      const type = (await p.locator('.qtype').first().innerText().catch(() => '')).trim();
      if (await p.locator('[data-multi]').count()) { await t('[data-multi="0"]'); await t('[data-multi="1"]'); await t('[data-check-multi]'); }
      else if (await p.locator('[data-m]').count()) { const n = await p.locator('.mcol').first().locator('[data-m]').count(); for (let i = 0; i < n; i++) { await t(`[data-m="L${i}"]`); for (let j = 0; j < n && !(await p.locator(`[data-m="L${i}"].done`).count()); j++) { const r = p.locator(`[data-m="R${j}"]:not([disabled])`); if (await r.count()) { if (!(await p.locator(`[data-m="L${i}"][aria-pressed="true"]`).count())) await t(`[data-m="L${i}"]`); await t(`[data-m="R${j}"]:not([disabled])`); } } } }
      else if (await p.locator('[data-opt]').count()) await t('[data-opt="0"]');
      else if (await p.locator('[data-reveal]').count()) { await t('[data-reveal]'); await t('[data-self="1"]'); }
      else if (await p.locator('#typedInput').count()) { await p.fill('#typedInput', 'x'); await p.press('#typedInput', 'Enter'); }
      await p.waitForTimeout(80);
      return type;
    };
    await go('#/lesson/words'); const types = new Set(); let explained = 0;
    for (let i = 0; i < 16 && !(await p.locator('.lessonend').count()); i++) {
      types.add(await answer());
      if (await p.locator('.feedback .fb-guest strong').count()) explained++;
      if (await p.locator('[data-continue]').count()) await t('[data-continue]');
      await p.waitForTimeout(60);
    }
    console.log(dev, 'words lesson types:', [...types].join(', '), '| answer screens with the definition:', explained, '| end:', (await p.locator('.lessonend').innerText().catch(() => '-')).replace(/\s+/g, ' ').slice(0, 120));
    if (!explained || !(await p.locator('.lessonend').count())) failed = true;
    // a lesson from the path: does it include a wine word?
    let sawWord = false;
    await go('#/learn');
    const lessons = await p.$$eval('#view .nodebtn', as => as.map(a => a.getAttribute('href')).slice(0, 6));
    for (const h of lessons) {
      await go(h);
      for (let i = 0; i < 14 && !(await p.locator('.lessonend').count()); i++) {
        const ty = await answer(); if (/what it means|name the term|match the meanings|which wine|find them all/i.test(ty)) sawWord = true;
        if (await p.locator('[data-continue]').count()) await t('[data-continue]');
      }
      if (sawWord) break;
    }
    console.log(dev, 'a path lesson included a wine word:', sawWord); if (!sawWord) failed = true;
    if (errs.length) { failed = true; console.log(dev, 'errors', errs); }
  }
  await b.close(); process.exit(failed ? 1 : 0);
})();
