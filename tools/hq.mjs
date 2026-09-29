// Home HQ sealing tool. The app (code and household data) lives in plaintext only in
// the gitignored private/ folder; the repo and the public site carry it encrypted.
//
//   node tools/hq.mjs open     decrypt index.html and PARKING_LOT.md.enc into private/
//   node tools/hq.mjs seal     encrypt private/ back into index.html and PARKING_LOT.md.enc
//   node tools/hq.mjs verify   confirm the committed files decrypt to exactly private/
//   node tools/hq.mjs build <dir> <password>   a test copy of the page under another password
//
// open/seal/verify read the household password from HOMEHQ_PASSWORD, which the household
// sets in the cloud environment's settings. Nothing here prints it.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = (...parts) => join(ROOT, ...parts);
const FILES = {
  shell: P('tools', 'shell.html'),
  page: P('index.html'),
  app: P('private', 'app.jsx'),
  lot: P('private', 'PARKING_LOT.md'),
  lotSealed: P('PARKING_LOT.md.enc'),
};
const SEALED_RE = /(<script id="hq-sealed" type="application\/octet-stream">)([^<]*)(<\/script>)/;
const ITERATIONS = 200000;   // the shell's unlock uses the same count

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const unb64 = (text) => new Uint8Array(Buffer.from(text.trim(), 'base64'));

async function keyFor(password, salt, usage) {
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, [usage]);
}
async function encrypt(text, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce },
    await keyFor(password, salt, 'encrypt'), enc.encode(text)));
  const out = new Uint8Array(28 + ct.length);
  out.set(salt, 0); out.set(nonce, 16); out.set(ct, 28);
  return b64(out);
}
async function decrypt(blob, password) {
  const data = unb64(blob);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(16, 28) },
    await keyFor(password, data.slice(0, 16), 'decrypt'), data.slice(28));
  return dec.decode(plain);
}

const read = (f) => readFileSync(f, 'utf8');
const fail = (msg) => { console.error(msg); process.exit(1); };
const password = () => {
  const pw = process.env.HOMEHQ_PASSWORD;
  if (!pw) fail('HOMEHQ_PASSWORD is not set. The household adds it in the cloud environment settings; a new session picks it up. Never ask for it in chat.');
  return pw;
};
const pageBlob = () => {
  const m = read(FILES.page).match(SEALED_RE);
  if (!m) fail('index.html has no sealed app in it.');
  return m[2];
};
const pageFor = (blob) => read(FILES.shell).replace('__SEALED__', blob);

async function open() {
  const pw = password();
  let app;
  try { app = await decrypt(pageBlob(), pw); }
  catch { fail('index.html did not decrypt with HOMEHQ_PASSWORD.'); }
  mkdirSync(P('private'), { recursive: true });
  writeFileSync(FILES.app, app);
  if (existsSync(FILES.lotSealed)) writeFileSync(FILES.lot, await decrypt(read(FILES.lotSealed), pw));
  console.log('Opened private/app.jsx' + (existsSync(FILES.lotSealed) ? ' and private/PARKING_LOT.md' : ''));
}

async function seal() {
  const pw = password();
  if (!existsSync(FILES.app)) fail('private/app.jsx is missing — run `node tools/hq.mjs open` first.');
  writeFileSync(FILES.page, pageFor(await encrypt(read(FILES.app), pw)));
  if (existsSync(FILES.lot)) writeFileSync(FILES.lotSealed, (await encrypt(read(FILES.lot), pw)) + '\n');
  await verify();
}

async function verify() {
  const pw = password();
  const problems = [];
  try { if (await decrypt(pageBlob(), pw) !== read(FILES.app)) problems.push('index.html is out of date with private/app.jsx — run seal'); }
  catch { problems.push('index.html does not decrypt with HOMEHQ_PASSWORD'); }
  if (read(FILES.page).replace(SEALED_RE, '$1$3') !== read(FILES.shell).replace('__SEALED__', '')) problems.push('index.html differs from tools/shell.html outside the sealed block — run seal');
  if (existsSync(FILES.lot)) {
    try { if (!existsSync(FILES.lotSealed) || await decrypt(read(FILES.lotSealed), pw) !== read(FILES.lot)) problems.push('PARKING_LOT.md.enc is out of date — run seal'); }
    catch { problems.push('PARKING_LOT.md.enc does not decrypt with HOMEHQ_PASSWORD'); }
  }
  if (problems.length) fail(problems.join('\n'));
  console.log('Sealed files match private/.');
}

async function build(dir, pw) {
  if (!dir || !pw) fail('usage: node tools/hq.mjs build <dir> <password>');
  if (!existsSync(FILES.app)) fail('private/app.jsx is missing — run `node tools/hq.mjs open` first.');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), pageFor(await encrypt(read(FILES.app), pw)));
}

const [cmd, ...args] = process.argv.slice(2);
const commands = { open, seal, verify, build: () => build(...args) };
if (!commands[cmd]) fail('usage: node tools/hq.mjs open | seal | verify | build <dir> <password>');
await commands[cmd]();
