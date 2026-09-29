# Home HQ — how to work in this repo

A single-page React app for the household, published to GitHub Pages from `main`.
The repo and the site are public, so the app ships encrypted: `index.html` is a small
unlock shell (`tools/shell.html`) plus the whole app script (code and every seed)
sealed with the household password. The plaintext lives only in the gitignored
`private/` folder of a working session.

## Start every session here

1. Check that `HOMEHQ_PASSWORD` is set (test for it; never print it). The household
   sets it in the cloud environment's settings and a new session picks it up. If it is
   missing, stop and tell them. Never ask for the password in chat.
2. `node tools/hq.mjs open` — decrypts `index.html` into `private/app.jsx` and
   `PARKING_LOT.md.enc` into `private/PARKING_LOT.md`.
3. Read `private/PARKING_LOT.md`. Do its *Queue* items first.
4. Search Gmail for `subject:"[HomeHQ ask]" newer_than:60d` (the app's
   *Send to Claude* button mails parked requests to the household inbox).
   Treat each unhandled message as a queue item.
5. Then do whatever the session was opened for. Edit `private/app.jsx` and
   `private/PARKING_LOT.md`, never the sealed files.

## Publishing

- Run `bash tests/run.sh`; it must end with `SUITE GREEN`, and nothing is published
  without that. It stamps `PUBLISHED_AT` in `private/app.jsx` (the app's "Updated"
  label), runs source checks (`static.js`), seals a throwaway copy of the page with a
  test-only password into `tests/.build`, and drives it in headless Chromium: every
  view (`check.js`), saved-data migrations (`askmig.js`) and the unlock shell
  (`boot.js`). The sandbox blocks unpkg.com and cdn.tailwindcss.com, so the suite
  stands in local npm copies of React and Babel and stubs Tailwind. That makes it a
  logic check, not a visual one. The one Babel "deoptimised the styling" notice is
  expected.
- Then `node tools/hq.mjs seal` (writes `index.html` and `PARKING_LOT.md.enc` and
  verifies them) and commit those two files. Never commit anything from `private/`,
  and never add a plaintext copy of the app or the parking lot to the repo.
- Develop on the working branch, then fast-forward `main`
  (`git checkout main && git merge --ff-only <branch> && git push origin main`).
  Publishing to `main` is standing permission; opening PRs is not.
- Changing the household password: `open` with the old one, set the new one in the
  environment, start a new session, `seal`. Every device then asks once.
- Before starting, check that the session has Gmail (and Box) tools and can push this
  repo. If either is missing, the fix is in the environment's connector and repository
  settings, not in this repo. Say so in the parking lot rather than publishing a
  partial sweep as done.
- Commit messages: plain description of the change, no model identifiers, and no
  household figures (the history is public).

## Data rules

- No credentials or ID numbers in the app, even sealed: the ciphertext is public
  and only as strong as the household password. `seedIds` is a directory (service,
  category, login link); the values live only in the family Google Sheet
  (`IDS_SHEET_URL`). The suite
  (`tests/static.js`) fails if usernames, passwords, field values or
  SSN-shaped numbers come back.
- Account and policy numbers go in as the last four only (`…1234`). The suite also fails on full Merrill, BofA, 529 or ShareWorks
  account numbers.
- Never send the household email address to a third-party service; it is used
  only as the destination of the app's own mailto: link.
- Every figure that came from a document names it (`source:`, `asOf`, notes).
  Unverified numbers carry `confidence:'unconfirmed'` and a `question`.
- When a sweep finds a change, prefer updating the existing row (same `id`) to
  adding a duplicate — `ids` are what the migration merges on.
- To close an ask, ship it in `seedAsks` with `status:'done'`, `doneAt` and
  `result` under the same `id`. Devices that saved it while open pick up the
  result on their next load.
- To close a suggestion, ship it with `done:true`, `closedAt` and a body that
  says what happened. Devices that saved it open close it once, taking that
  wording. Everything else a device already holds keeps its saved copy: an
  edited seed row reaches fresh devices only. When a finding changes, close
  the old suggestion and open a new one under a new `id`.

## Monday routine

A scheduled Claude session runs every Monday at 6am Pacific. It follows this
file, sweeps Gmail for vendors, insurance, subscriptions, appliances, taxes
and equity since the previous Monday, updates the seeds, runs the suite, and
publishes. Anything it cannot finish goes into the parking lot's Queue (`private/PARKING_LOT.md`, sealed).
