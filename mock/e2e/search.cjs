// Every search box finds a wine the way a guest says it: "cotes du rhone" finds Bout d'Zan in the mock's search
// bar, the wine picker, Take off stock and the Stock screen; and in the study tool's own wine list and map.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
(async () => {
  let failed = false; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed = true; };
  const b = await chromium.launch();
  // the mock
  const p = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(150); };
  await p.goto('file://' + path.resolve(__dirname, '../dist/wine-app.html')); await p.click('[data-signin]'); await p.click('[data-as="both"]'); await p.waitForTimeout(120);
  await p.fill('#gq', 'cotes du rhone'); await p.waitForTimeout(80);
  const bar = await p.locator('#gres').innerText();
  check(/Bout d'Zan/.test(bar) && /which includes Côtes du Rhône/.test(bar), 'mock search bar: "cotes du rhone" finds Bout d\'Zan and says why');
  await p.fill('#gq', ''); await p.waitForTimeout(50);
  await go('#take-off'); await p.fill('#tkSearch', 'Côte du Rhône'); await p.waitForTimeout(100);
  check((await p.locator('[data-pick]').allInnerTexts()).some(t => /Bout d'Zan/.test(t)), 'Take off stock: "Côte du Rhône" finds it');
  await go('#delivery'); await p.fill('[data-wpick-q="dadd"]', 'cotes rhone'); await p.waitForTimeout(80);
  check(/Bout d'Zan/.test(await p.locator('#wpl-dadd').innerText()), 'wine picker: "cotes rhone" finds it');
  await go('#stock'); await p.fill('#stockSearch', 'cotes du rhone'); await p.waitForTimeout(150);
  check((await p.locator('#view tbody').innerText()).includes("Bout d'Zan"), 'Stock screen: the filter finds it');
  await p.fill('#gq', 'bout dzan'); await p.waitForTimeout(80);
  check(/Bout d'Zan/.test(await p.locator('#gres').innerText()), 'mock search bar: "bout dzan", no apostrophe');
  if (errs.length) { failed = true; console.log('mock errors', errs); }
  // the study tool itself, served as GitHub Pages serves it
  const root = path.resolve(__dirname, '../..');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.csv': 'text/csv' };
  const server = http.createServer((req, res) => { const f = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/?local`;
  const s = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage(); const errs2 = []; s.on('pageerror', e => errs2.push(e.message));
  await s.goto(base); await s.waitForTimeout(600);
  if (await s.locator('[data-pick="service"]').count()) await s.click('[data-pick="service"]');
  await s.evaluate(() => location.hash = '#/list'); await s.waitForTimeout(300);
  await s.fill('#listq', 'cotes du rhone'); await s.waitForTimeout(150);
  const list = await s.locator('#listbody').innerText();
  check(/Bout d'Zan/.test(list) && /which includes Côtes du Rhône/.test(list), 'study tool, Service wine list: the new search box finds it, with the reason');
  check(await s.evaluate(() => document.activeElement && document.activeElement.id === 'listq'), 'study tool: the search box keeps focus while typing');
  await s.fill('#listq', ''); await s.waitForTimeout(100);
  check(/By the glass/.test(await s.locator('#listbody').innerText()), 'study tool: clearing the box brings the full list back');
  await s.evaluate(() => location.hash = '#/map'); await s.waitForTimeout(1500);
  await s.fill('#q', 'cotes du rhone'); await s.waitForTimeout(200);
  check(/Bout d'Zan/.test(await s.locator('#results').innerText()), 'study tool, connections map: its search finds it');
  if (errs2.length) { failed = true; console.log('study tool errors', errs2); }
  server.close(); await b.close(); process.exit(failed ? 1 : 0);
})();
