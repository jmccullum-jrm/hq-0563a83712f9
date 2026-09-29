// Source checks that need no browser. The repo and site are public: index.html may carry
// the app only in its sealed block, the plaintext source stays in private/, and even that
// source keeps credentials, ID numbers and full account numbers out (it is only as safe as
// the household password). The publish stamp must have been written by this run.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));
const SEALED = /<script id="hq-sealed" type="application\/octet-stream">[^<]*<\/script>/;

const app = exists('private/app.jsx') ? read('private/app.jsx') : '';
const page = read('index.html');
const shellOnly = page.replace(SEALED, '');
const texts = [
  ['private/app.jsx', app], ['index.html (outside the sealed block)', shellOnly],
  ...['private/PARKING_LOT.md', 'CLAUDE.md', 'README.md', 'tools/shell.html', 'tools/hq.mjs'].filter(exists).map(f => [f, read(f)]),
  ...fs.readdirSync(__dirname).filter(f => /\.(js|sh)$/.test(f)).map(f => ['tests/' + f, read('tests/' + f)]),
];
const ids = (app.match(/const seedIds = \[([\s\S]*?)\n    \];/) || [])[1];
const stamp = (app.match(/const PUBLISHED_AT = '([^']*)';/) || [])[1];
const SSN = /(?<![\d-])\d{3}-\d{2}-\d{4}(?![\d-])/;
// Account numbers go in as the last four only ("…4006"). The shapes these
// institutions use: Merrill ddd-ddddd, BofA dddd dddd dddd, 529 ddddddddd-dd,
// ShareWorks CSdddddddd / DS-dddddd-dd.
const ACCT = /\b\d{3}-\d{5}\b|\b\d{4} \d{4} \d{4}\b|\b\d{9}-\d{2}\b|\b[CD]S-?\d{6,}/;
const offenders = (re) => texts.filter(([, t]) => re.test(t)).map(([f]) => f);
const checks = {
  'private/app.jsx present (node tools/hq.mjs open)': !!app,
  'index.html carries a sealed app': SEALED.test(page),
  'no app source outside the sealed block': !/seedVendors|PORTFOLIO_DATA|householdTotal|const App\b/.test(shellOnly),
  'no plaintext parking lot in the repo': !exists('PARKING_LOT.md'),
  'seedIds found': !!ids,
  'no usernames, passwords or values in seedIds': !!ids && !/\b(username|password|fields|notes)\s*:/.test(ids),
  'no SSN-shaped numbers': offenders(SSN).length === 0,
  'no full account numbers': offenders(ACCT).length === 0,
  'PUBLISHED_AT stamped by this run': !!stamp && Math.abs(Date.now() - Date.parse(stamp)) < 10 * 60 * 1000,
};
console.log(JSON.stringify(checks, null, 1), offenders(SSN).concat(offenders(ACCT)));
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
