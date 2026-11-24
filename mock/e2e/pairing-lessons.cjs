// Pairings in the lessons: Before service asks two tasting-menu questions beside three on the glass list, never about a
// wine that is off tonight, and the tasting-menu unit asks which wine, which dish and why the pairing works.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  let failed = false; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed = true; };
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../dist/wine-app.html')); await p.click('[data-signin]'); await p.click('[data-as="sam"]'); await p.waitForTimeout(150);
  const PAIR = ['Pairing', 'Why it works', 'Which pairing'];
  // Answers whatever comes up until the lesson ends; returns each question's chip, prompt and feedback.
  async function run(hash) {
    await p.evaluate(h => { location.hash = '#/learn'; setTimeout(() => location.hash = h, 50); }, hash); await p.waitForTimeout(300);
    if (await p.locator('[data-taste-none]').count()) { await p.click('[data-taste-none]'); await p.waitForTimeout(100); }
    const seen = [];
    for (let i = 0; i < 30 && !(await p.locator('.lessonend').count()); i++) {
      const chip = (await p.locator('.lessonview .qtype').first().textContent({ timeout: 1500 }).catch(() => '')).trim(), prompt = await p.locator('.qprompt').first().innerText().catch(() => '');
      const c = sel => p.locator(sel).first().click({ timeout: 1500 }).catch(() => {});
      if (await p.locator('[data-opt="0"]:not([disabled])').count()) await c('[data-opt="0"]');
      else if (await p.locator('[data-reveal]').count()) await c('[data-reveal]');
      else if (await p.locator('#typedInput').count()) { await p.fill('#typedInput', (await p.getAttribute('#typedInput', 'inputmode')) === 'decimal' || (await p.getAttribute('#typedInput', 'type')) === 'number' ? '1' : 'x'); await p.press('#typedInput', 'Enter'); }
      else if (await p.locator('[data-check-multi]').count()) { await c('[data-multi]'); await c('[data-check-multi]'); }
      else for (let k = 0; k < 40 && !(await p.locator('.feedback').count()); k++) { // match: try each left with each right
        const L = p.locator('[data-m^="L"]:not([disabled])'), R = p.locator('[data-m^="R"]:not([disabled])');
        if (!(await L.count()) || !(await R.count())) break;
        await L.first().click({ timeout: 1500 }).catch(() => {}); await R.nth(k % (await R.count())).click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(30);
      }
      await p.waitForTimeout(60);
      if (await p.locator('[data-self="1"]').count()) await p.click('[data-self="1"]', { timeout: 1500 }).catch(() => {});
      const fb = await p.locator('.feedback').textContent({ timeout: 1500 }).catch(() => '');
      if (!chip) { if (process.env.DBG) console.log('    no question:', (await p.locator('#view').textContent()).slice(0, 200)); break; }
      seen.push({ chip, prompt, fb }); if (process.env.DBG) console.log('   ', Date.now() % 100000, chip, '|', prompt.slice(0, 50), '|', fb.slice(0, 30));
      if (await p.locator('[data-continue]').count()) await p.click('[data-continue]', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(60);
    }
    return seen;
  }
  let allTwo = true, offAsked = false, whyShown = false;
  for (let r = 0; r < (process.env.RUNS ? +process.env.RUNS : 4); r++) {
    // the exact three and two are a unit test (test/pairings.test.js); here wrong answers bring wines back, so look for any
    const qs = await run('#/lesson/service'), pair = qs.filter(q => PAIR.includes(q.chip));
    if (qs.length < 5 || !pair.length) { allTwo = false; console.log('  before service run', r, qs.map(q => q.chip).join(', ')); }
    if (pair.some(q => /Villo|pollack/i.test(q.prompt))) offAsked = true;
    if (pair.some(q => /Why it works:/.test(q.fb) && q.chip === 'Pairing')) whyShown = true;
  }
  check(allTwo, 'Before service: asks about the tasting menu every time');
  check(!offAsked, 'Before service: never asks about the pollack, whose wine is off tonight');
  const types = new Set();
  for (let k = 0; k < 9 && !PAIR.every(t => types.has(t)); k++) (await run(`#/lesson/pairings-${k % 3 + 1}`)).forEach(q => { types.add(q.chip); if (q.chip === 'Pairing' && /Why it works:/.test(q.fb)) whyShown = true; });
  check(whyShown, 'a pairing answer says why it works');
  check(PAIR.every(t => types.has(t)), `the tasting menu unit asks which wine or dish, why it works, and which pairing (${[...types].join(', ')})`);
  await p.evaluate(() => location.hash = '#/wine/montanetthoden-garance'); await p.waitForTimeout(200);
  check(/Why it works: Its fresh, lifted Pinot acidity/.test(await p.locator('#view').innerText()), 'the wine card says why the pairing works');
  if (errs.length) { failed = true; console.log('errors', errs); }
  await b.close(); process.exit(failed ? 1 : 0);
})();
