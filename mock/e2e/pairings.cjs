// The Pairings screen, in the study tool (served as GitHub Pages serves it) and in the app's Service area.
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
(async () => {
  let failed = false; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed = true; };
  const b = await chromium.launch(), D = process.env.SHOTS || '';
  // the study tool
  const root = path.resolve(__dirname, '../..'), types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.csv': 'text/csv' };
  const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, u === '/' ? 'index.html' : u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(0);
  const s = await (await b.newContext(devices['iPhone 13'])).newPage(); const e1 = []; s.on('pageerror', e => e1.push(e.message));
  await s.goto(`http://127.0.0.1:${server.address().port}/?local`); await s.waitForTimeout(600);
  if (await s.locator('[data-pick="service"]').count()) await s.locator('[data-pick="service"]').tap();
  check(await s.locator('nav#nav a[href="#/pairings"]').count() === 1, 'study tool: Pairings is in the menu');
  await s.locator('nav#nav a[href="#/pairings"]').tap(); await s.waitForTimeout(250);
  check(await s.evaluate(() => document.body.dataset.mode) === 'service', 'study tool: it opens in Service, dark');
  check((await s.locator('.pp-course').count()) === 6 && (await s.locator('.pp-dish').count()) === 14, 'study tool: 6 courses, 14 dishes');
  await s.locator('[data-pp-jump="pp-3"]').tap(); await s.waitForTimeout(600);
  check(await s.evaluate(() => location.hash === '#/pairings' && Math.abs(document.getElementById('pp-3').getBoundingClientRect().top) < 260), 'study tool: a course button scrolls to the mains and stays on the screen');
  await s.locator('#pp-3 .script summary').first().tap(); await s.waitForTimeout(100);
  check(/Torretta Granitola/.test(await s.locator('#pp-3 .script[open]').first().innerText()), 'study tool: the pollack script opens');
  if (D) await s.screenshot({ path: D + '/study-pairings.png' });
  await s.locator('#pp-3 .winerow').first().tap(); await s.waitForTimeout(200);
  check(/^#\/wine\/gili-villo/.test(await s.evaluate(() => location.hash)), 'study tool: a wine opens its card');
  if (e1.length) { failed = true; console.log('study tool errors', e1); }
  server.close();
  // the app (mock)
  const p = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage(); const e2 = []; p.on('pageerror', e => e2.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../dist/wine-app.html')); await p.click('[data-signin]'); await p.click('[data-as="sam"]'); await p.waitForTimeout(150);
  check(/Pollack.*Villo Grillo.*Off tonight/s.test(await p.locator('#view').innerText()), 'app, Tonight: says the pollack\'s wine is off tonight');
  await p.click('#nav a[href="#/pairings"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.body.dataset.area) === 'service', 'app: Pairings is in Service');
  const pollack = await p.locator('#pp-3 .pp-dish').first().innerText();
  check(/Off tonight/.test(pollack) && /Offer .+ instead/.test(pollack), 'app: the pollack pairing shows Off tonight and what to offer');
  check(/On tonight/.test(await p.locator('#pp-3 .pp-dish').nth(1).innerText()), 'app: the venison pairing is on tonight');
  check(await p.locator('#nav a[href="#pairings"]').innerText() === 'Pairings', 'app: Office has Pairings too (the editor, and the pours)');
  if (D) await p.screenshot({ path: D + '/app-pairings.png', fullPage: false });
  if (e2.length) { failed = true; console.log('app errors', e2); }
  await b.close(); process.exit(failed ? 1 : 0);
})();
