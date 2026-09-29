const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 8765;
const BASE = `http://127.0.0.1:${PORT}`;
const DEPS = path.join(__dirname, 'node_modules');
const CDN_MAP = {
  'https://unpkg.com/react@18/umd/react.production.min.js': path.join(DEPS, 'react/umd/react.production.min.js'),
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js': path.join(DEPS, 'react-dom/umd/react-dom.production.min.js'),
  'https://unpkg.com/@babel/standalone@7/babel.min.js': path.join(DEPS, '@babel/standalone/babel.min.js'),
};
// cdn.tailwindcss.com is the v3 Play CDN (window.tailwind global); stub it — styling only, not logic.
const TAILWIND_STUB = "window.tailwind = window.tailwind || {};";
const NAV_GROUPS = [
  { label: 'Today',    leaves: ['Today', 'Ask Claude'] },
  { label: 'Money',    leaves: ['Portfolio', 'Subscriptions', 'Suggestions'] },
  { label: 'Houses',   leaves: ['Maintenance', 'Vendors', 'Appliances', 'Property', 'Utilities'] },
  { label: 'Coverage', leaves: ['Insurance', 'Vehicles', 'Benefits'] },
  { label: 'Vault',    leaves: ['IDs & Logins', 'Files', 'Done'] },
  { label: 'Cellar',   leaves: ['Wine'] },
];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // A remembered test password lets the shell unlock the test build (sealed with it by
  // run.sh) without the form; an empty saved state makes the app start from the seeds.
  await page.addInitScript((key) => {
    localStorage.setItem('homehq.k', key);
    localStorage.setItem('homehq.shared.v1', '{}');
  }, Buffer.from(process.env.HQ_TEST_PASSWORD || '').toString('base64'));
  await page.route('**', async (route) => {
    const fullUrl = route.request().url();
    const url = fullUrl.split('?')[0].replace(/\/$/, '');
    const local = CDN_MAP[url];
    if (local) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(local) });
    if (url === 'https://cdn.tailwindcss.com') return route.fulfill({ status: 200, contentType: 'application/javascript', body: TAILWIND_STUB });
    // The app checks the published updates feed on load whenever a household key is saved.
    if (/github\.io\/.*updates\.json/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (/^https:\/\/fonts\.googleapis\.com/.test(fullUrl)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (/^https:\/\/fonts\.gstatic\.com/.test(fullUrl)) return route.fulfill({ status: 200, contentType: 'font/woff2', body: Buffer.alloc(0) });
    return route.continue();
  });
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => (document.getElementById('root')?.children.length || 0) > 0, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const clickByText = async (label, insideAside) => page.evaluate(({ label, insideAside }) => {
    const scope = insideAside ? document.querySelectorAll('aside nav button') : document.querySelectorAll('main button, section button');
    // Count badges are concatenated onto labels ("Money40"); strip trailing digits.
    const el = Array.from(scope).find((n) => (n.textContent || '').trim().replace(/\d+$/, '').trim() === label);
    if (el) { el.click(); return true; }
    return false;
  }, { label, insideAside });
  let ok = true;
  for (const g of NAV_GROUPS) {
    const before = errors.length;
    const clicked = await clickByText(g.label, true);
    await page.waitForTimeout(300);
    console.log(`[group:${g.label}] clicked=${clicked} newErrors=${errors.length - before}`);
    if (!clicked) ok = false;
    for (const leaf of g.leaves) {
      const b2 = errors.length;
      const clicked2 = g.leaves.length > 1 ? await clickByText(leaf, false) : true;
      await page.waitForTimeout(300);
      const newErrs = errors.slice(b2);
      console.log(`  [leaf:${leaf}] clicked=${clicked2} newErrors=${newErrs.length}`);
      newErrs.forEach((e) => console.log('     ' + e));
      if (!clicked2) ok = false;
    }
  }
  const rootHasContent = await page.evaluate(() => (document.getElementById('root')?.children.length || 0) > 0);
  console.log('root rendered children:', rootHasContent);
  const updatedLabel = await page.evaluate(() => /Updated [A-Z][a-z]{2} \d/.test(document.body.innerText));
  console.log('"Updated" label shown:', updatedLabel);
  if (!updatedLabel) ok = false;
  const KNOWN_BENIGN = /\[BABEL\] Note: The code generator has deoptimised/;
  const uniqueErrors = [...new Set(errors)];
  const hardErrors = uniqueErrors.filter((e) => !KNOWN_BENIGN.test(e));
  console.log('--- TOTAL UNIQUE ERRORS:', uniqueErrors.length, `(${hardErrors.length} not known-benign)`, '---');
  uniqueErrors.forEach((e) => console.log(e));
  await browser.close();
  process.exit(hardErrors.length > 0 || !ok || !rootHasContent ? 1 : 0);
})();
