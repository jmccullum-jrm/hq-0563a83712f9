// The unlock shell against the test build: form first, a wrong password refused, the
// right one opens the app and is remembered, a remembered one opens it with no form,
// and a remembered password that no longer works is dropped and asked for again.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const DEPS = path.join(__dirname, 'node_modules');
const PW = process.env.HQ_TEST_PASSWORD || '';
const MAP = {
  'https://unpkg.com/react@18/umd/react.production.min.js': 'react/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js': 'react-dom/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7/babel.min.js': '@babel/standalone/babel.min.js',
};
const URL = 'http://127.0.0.1:8765/index.html';
const route = (r) => {
  const u = r.request().url().split('?')[0].replace(/\/$/, '');
  if (MAP[u]) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(DEPS, MAP[u])) });
  if (u === 'https://cdn.tailwindcss.com') return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.tailwind={};' });
  if (/fonts\.g/.test(u)) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
  return r.continue();
};
const appUp = (p) => p.waitForFunction(() => (document.getElementById('root')?.children.length || 0) > 0, null, { timeout: 60000 }).then(() => true, () => false);
const formUp = (p) => p.waitForFunction(() => document.getElementById('hq-unlock')?.style.display === 'flex', null, { timeout: 15000 }).then(() => true, () => false);
const errText = (p) => p.evaluate(() => { const e = document.getElementById('hq-err'); return e && e.style.display !== 'none' ? e.textContent : ''; });
const stored = (p) => p.evaluate(() => localStorage.getItem('homehq.k'));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const fresh = async (init) => {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    if (init) await p.addInitScript(init.fn, init.arg);
    await p.route('**', route);
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL, { waitUntil: 'networkidle' });
    return p;
  };
  const checks = {};

  let p = await fresh();
  checks['no saved password: form shown, app locked'] = await formUp(p)
    && await p.evaluate(() => document.getElementById('root').children.length === 0);
  await p.fill('#hq-pw', 'not-the-password');
  await p.click('#hq-go');
  await p.waitForFunction(() => document.getElementById('hq-err')?.style.display === 'block', null, { timeout: 15000 }).catch(() => {});
  checks['wrong password refused'] = /didn't work/.test(await errText(p))
    && await p.evaluate(() => document.getElementById('root').children.length === 0);
  await p.fill('#hq-pw', PW);
  await p.click('#hq-go');
  checks['right password opens the app'] = await appUp(p) && !(await p.$('#hq-unlock'));
  checks['kept password remembered'] = (await stored(p)) === Buffer.from(PW).toString('base64');
  await p.reload({ waitUntil: 'networkidle' });
  checks['remembered password opens with no form'] = await appUp(p) && !(await p.$('#hq-unlock'));
  await p.context().close();

  p = await fresh();
  await formUp(p);
  await p.uncheck('#hq-keep');
  await p.fill('#hq-pw', PW);
  await p.click('#hq-go');
  checks['unticked "stay unlocked" is not remembered'] = await appUp(p) && (await stored(p)) === null;
  await p.context().close();

  p = await fresh({ fn: (k) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('homehq.k', k); } },
                    arg: Buffer.from('an-old-password').toString('base64') });
  checks['stale saved password dropped and asked for'] = await formUp(p)
    && /changed/.test(await errText(p)) && (await stored(p)) === null;
  await p.context().close();

  checks['no page errors'] = errs.length === 0;
  console.log(JSON.stringify(checks, null, 1), errs);
  await b.close();
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})();
