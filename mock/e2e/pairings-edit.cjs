// Office → Pairings: the wine lead edits the tasting menu, and Service, the wine cards and search follow at once.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  let failed = false; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed = true; };
  const b = await chromium.launch(), D = process.env.SHOTS || '';
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(150); };
  const service = async () => { await go('#/pairings'); return p.locator('#view').innerText(); };
  await p.goto('file://' + path.resolve(__dirname, '../dist/wine-app.html')); await p.click('[data-signin]'); await p.click('[data-as="sommelier"]'); await p.waitForTimeout(150);
  await go('#pairings');
  check(await p.locator('[data-pe-tab="menu"][aria-pressed="true"]').count() === 1, 'the wine lead opens on the tasting menu, with Pours alongside');
  check(await p.locator('.pe-dish').count() === 14, 'all 14 dishes are listed');
  // edit the venison
  await p.click('.pe-dish:has-text("Venison") [data-pe-edit]');
  await p.fill('#pe-detail', 'Venison, celeriac, blackberry'); await p.fill('#pe-s0', 'A new script for the venison.');
  await p.click('[data-pe-save]'); await p.waitForTimeout(100);
  check((await service()).includes('Venison, celeriac, blackberry'), 'edit: the new dish description is on the Service Pairings screen');
  await go('#/wine/montanetthoden-garance'); check((await p.locator('.card').innerText()).includes('Venison, celeriac, blackberry'), 'edit: and on the Garance card');
  // add a dish to the mains, with a wine found by search
  await go('#pairings'); await p.click('[data-pe-add="4"]');
  await p.fill('#pe-dish', 'Halibut'); await p.fill('[data-wpick-q="pe-w0"]', 'galerne'); await p.waitForTimeout(80); await p.click('#wpl-pe-w0 [data-wpick-opt]');
  await p.fill('#pe-s0', 'Vézelay Chardonnay for the halibut.'); await p.click('[data-pe-save]'); await p.waitForTimeout(100);
  const svc = await service();
  check(/Main[\s\S]*Beetroot[\s\S]*Halibut[\s\S]*Vézelay Galerne[\s\S]*Cheese/.test(svc), 'add: Halibut with Galerne is in Service, at the end of the mains');
  await p.fill('#gq', 'halibut'); await p.waitForTimeout(80);
  check(/Galerne/.test(await p.locator('#gres').innerText()), 'add: search finds Galerne by "halibut"');
  await p.fill('#gq', '');
  // a new course, moved before dessert
  await go('#pairings'); await p.click('[data-pe-newcourse]');
  await p.fill('#pe-course', 'Pre-dessert'); await p.fill('#pe-dish', 'Sorbet'); await p.fill('[data-wpick-q="pe-w0"]', 'moscatello'); await p.waitForTimeout(80); await p.click('#wpl-pe-w0 [data-wpick-opt]');
  await p.click('[data-pe-save]'); await p.waitForTimeout(100);
  await p.click('.pe-course:has(h2:text-is("Pre-dessert")) [data-pe-move][data-dir="-1"]'); await p.waitForTimeout(100);
  check(/Cheese[\s\S]*Pre-dessert[\s\S]*Sorbet[\s\S]*Dessert/.test(await service()), 'new course: Pre-dessert, moved up, sits between the cheese and dessert in Service');
  // rename a course
  await go('#pairings'); await p.click('.pe-course:has(h2:has-text("Main")) [data-pe-course]');
  await p.fill('[data-pe-cfield="course"]', 'Mains'); await p.click('[data-pe-csave]'); await p.waitForTimeout(100);
  check(/Mains/.test(await service()), 'rename: the course is called Mains in Service');
  // retire the beetroot, undo, retire again, bring it back
  await go('#pairings'); await p.click('.pe-dish:has-text("Beetroot") [data-pe-retire]'); await p.waitForTimeout(80);
  check(!/Beetroot/.test(await service()), 'retire: Beetroot leaves the Service screen');
  await go('#/wine/matthieu-cosse-fronsac'); check(!/On the tasting menu/.test(await p.locator('.card').innerText()), 'retire: and the Fronsac card');
  await go('#pairings'); await p.click('[data-pe-showretired]'); await p.selectOption('[id="pe-back-|Retired|Beetroot|retired"]', { label: 'Mains' }); await p.click('[data-pe-back="|Retired|Beetroot|retired"]'); await p.waitForTimeout(80);
  check(/Mains[\s\S]*Beetroot[\s\S]*Fronsac/.test(await service()), 'bring back: Beetroot is back in the mains with Fronsac');
  // either/or wines
  await go('#pairings'); await p.click('.pe-dish:has-text("Trout") [data-pe-edit]'); await p.click('[data-pe-addwine]');
  await p.fill('[data-wpick-q="pe-w1"]', 'horsmonden'); await p.waitForTimeout(80); await p.click('#wpl-pe-w1 [data-wpick-opt]');
  await p.fill('#pe-note', 'Either is fine'); await p.click('[data-pe-save]'); await p.waitForTimeout(100);
  const trout = await p.locator('.pe-dish:has-text("Trout")').innerText();
  check(/Riesling\+[\s\S]*or[\s\S]*Horsmonden/.test(trout) && /Either is fine/.test(trout), 'either/or: the trout takes Riesling+ or Horsmonden, with the note');
  // validation
  await p.click('[data-pe-add="1"]'); await p.click('[data-pe-save]'); await p.waitForTimeout(80);
  check(/Give the dish a name/.test(await p.locator('.toast span').innerText()), 'a dish with no name is not saved');
  await p.click('[data-pe-cancel]');
  if (D) await p.screenshot({ path: D + '/pairings-editor.png' });
  // floor staff can't edit
  await go('#me'); await p.click('#view [data-logout]'); await p.click('[data-signin]'); await p.click('[data-as="sam"]'); await p.waitForTimeout(120);
  await go('#pairings');
  check(await p.locator('[data-pe-tab], [data-pe-edit]').count() === 0, 'floor staff see the pours only, no editing');
  if (errs.length) { failed = true; console.log('errors', errs); }
  await b.close(); process.exit(failed ? 1 : 0);
})();
