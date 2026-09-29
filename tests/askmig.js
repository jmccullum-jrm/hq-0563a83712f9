// Simulates a device saved before the 9/6 and 9/28 asks existed, with one ask still open,
// and suggestions saved before the 9/28 sweep closed some of them.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const DEPS = path.join(__dirname, 'node_modules');
const MAP = {
  'https://unpkg.com/react@18/umd/react.production.min.js': 'react/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js': 'react-dom/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7/babel.min.js': '@babel/standalone/babel.min.js',
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.addInitScript((key) => {
    localStorage.setItem('homehq.k', key);   // unlocks the test build without the form
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('homehq.unlockRemembered', '1');
    localStorage.setItem('homehq.shared.v1', JSON.stringify({ asks: [
      { id:'ask-newcar', status:'done', text:'car', result:'kept' },
      { id:'ask-finance', status:'open', text:'finance (saved while open)' },
      { id:'ask-mine', status:'open', text:'user-typed ask' },
    ], suggestions: [
      { id:'sg-q3-estimate', done:false, title:'old q3 wording', body:'old' },
      { id:'sg-vendor-balances', done:false, title:'reopened by the household', body:'old', closedBySeed:'2026-09-28' },
      { id:'sg-stripe-position', done:false, title:'untouched', body:'old' },
    ], ids: [
      { id:'id-etrade', category:'Financial', service:'E*Trade (Amanda)', username:'u', password:'p', fields:[['Account #','1']], notes:'n' },
    ]}));
    localStorage.setItem('homehq.deleted.v1', JSON.stringify(['ask-updates-0906']));
  }, Buffer.from(process.env.HQ_TEST_PASSWORD || '').toString('base64'));
  await p.route('**', r => {
    const u = r.request().url().split('?')[0].replace(/\/$/, '');
    if (MAP[u]) return r.fulfill({ status:200, contentType:'application/javascript', body: fs.readFileSync(path.join(DEPS, MAP[u])) });
    if (u === 'https://cdn.tailwindcss.com') return r.fulfill({ status:200, contentType:'application/javascript', body:'window.tailwind={};' });
    if (/fonts\.g/.test(u)) return r.fulfill({ status:200, contentType:'text/css', body:'' });
    return r.continue();
  });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil:'networkidle' });
  await p.waitForFunction(() => (document.getElementById('root')?.children.length || 0) > 0, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const asks = await p.evaluate(() => JSON.parse(localStorage.getItem('homehq.shared.v1') || '{}').asks || []);
  const by = Object.fromEntries(asks.map(a => [a.id, a]));
  const sugs = await p.evaluate(() => JSON.parse(localStorage.getItem('homehq.shared.v1') || '{}').suggestions || []);
  const sg = Object.fromEntries(sugs.map(x => [x.id, x]));
  const ids = await p.evaluate(() => JSON.parse(localStorage.getItem('homehq.shared.v1') || '{}').ids || []);
  const etrade = ids.find(x => x.id === 'id-etrade');
  const checks = {
    'finance flipped to done with result': by['ask-finance']?.status === 'done' && !!by['ask-finance']?.result,
    'user ask kept, still open': by['ask-mine']?.status === 'open',
    'new seed asks added': !!by['ask-vendors-0906'] && !!by['ask-sweep-0928'],
    'deleted ask stays deleted': !by['ask-updates-0906'],
    'seed-closed suggestion closes with its closing note': sg['sg-q3-estimate']?.done === true && /paid 9\/15/.test(sg['sg-q3-estimate']?.title || ''),
    'reopened suggestion stays open': sg['sg-vendor-balances']?.done === false && sg['sg-vendor-balances']?.title === 'reopened by the household',
    'open suggestion untouched': sg['sg-stripe-position']?.done === false && sg['sg-stripe-position']?.title === 'untouched',
    'saved logins scrubbed, row kept': !!etrade && !('password' in etrade) && !('username' in etrade) && !('fields' in etrade) && !('notes' in etrade),
    'new sweep suggestions added': !!sg['sg-anthropic-exercise-0928'] && !!sg['sg-fsa-receipts-0928'],
    'no page errors': errs.length === 0,
  };
  console.log(JSON.stringify(checks, null, 1), errs);
  await b.close();
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})();
