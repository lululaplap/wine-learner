// Taste it, from a wine's card: straight to the tasting grid, then the notes beside yours, sent to the sommelier,
// and back to the card, which shows your tasting. Tapping it again starts a fresh grid. Laptop and phone.
const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  let failed = false; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed = true; };
  const b = await chromium.launch(), url = 'file://' + path.resolve(__dirname, '../dist/wine-app.html');
  for (const [dev, o] of [['laptop', { viewport: { width: 1280, height: 860 } }], ['phone', devices['iPhone 13']]]) {
    const p = await (await b.newContext(o)).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const t = s => (o.hasTouch ? p.locator(s).first().tap() : p.locator(s).first().click());
    await p.goto(url); await t('[data-signin]'); await t('[data-as="sam"]'); await p.waitForTimeout(150);
    // a bottle that isn't open: tasting from the card doesn't depend on it
    for (const id of ['montanetthoden-garance', 'matthieu-cosse-fronsac']) {
      await p.evaluate(h => location.hash = h, '#/wine/' + id); await p.waitForTimeout(200);
      check(await p.locator('#view [data-taste-it]').innerText() === 'Taste it', `${dev}: ${id} card has Taste it`);
    }
    await p.evaluate(() => location.hash = '#/wine/montanetthoden-garance'); await p.waitForTimeout(200);
    await t('#view [data-taste-it]'); await p.waitForTimeout(250);
    check(await p.locator('.tastegrid').count() === 1 && /Taste Garance/.test(await p.locator('.lessontitle').innerText()), `${dev}: it opens the tasting grid for Garance, no questions first`);
    await t('.gchip[data-score]'); await t('.gchip.flav'); await p.fill('#tasteNote', 'Cherry and a bit of earth');
    await t('[data-taste-done]'); await p.waitForTimeout(200);
    check(await p.locator('.tasteresult').count() === 1 && /you and the notes/.test(await p.locator('.qprompt').innerText()), `${dev}: then your notes beside the card's`);
    await t('[data-copy]'); await p.waitForTimeout(150);
    check(/Sent/.test(await p.locator('.copied').innerText()), `${dev}: sent to the sommelier`);
    await t('.tasteresult a.btn[href^="#/wine/"]'); await p.waitForTimeout(250);
    const card = await p.locator('#view').innerText();
    check(/^#\/wine\/montanetthoden-garance/.test(await p.evaluate(() => location.hash)) && /Your tasting/i.test(card) && /Cherry and a bit of earth/.test(card), `${dev}: back on the card, with your tasting on it`);
    check(await p.locator('#view [data-taste-it]').innerText() === 'Taste it again', `${dev}: the button now says Taste it again`);
    await t('#view [data-taste-it]'); await p.waitForTimeout(250);
    check(await p.locator('.tastegrid').count() === 1 && await p.locator('.gchip[aria-pressed="true"]').count() === 0, `${dev}: again opens a fresh grid`);
    await t('.tastegrid a.btn[href^="#/wine/"]'); await p.waitForTimeout(200);
    check(/^#\/wine\/montanetthoden-garance/.test(await p.evaluate(() => location.hash)), `${dev}: Not now goes back to the card`);
    // and the two questions after, if wanted
    await t('#view [data-taste-it]'); await p.waitForTimeout(200); await t('[data-taste-done]'); await p.waitForTimeout(150); await t('[data-taste-next]'); await p.waitForTimeout(200);
    check(await p.locator('.question').count() === 1, `${dev}: Two questions on it starts the questions`);
    if (errs.length) { failed = true; console.log(dev, 'errors', errs); }
  }
  await b.close(); process.exit(failed ? 1 : 0);
})();
