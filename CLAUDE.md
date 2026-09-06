# Home HQ — how to work in this repo

Single-file React app (`index.html`) for the McCullum household, published to
GitHub Pages from `main`. Everything the app knows is seeded in that file.

## Start every session here

1. Read `PARKING_LOT.md`. Do its *Queue* items first.
2. Search Gmail for `subject:"[HomeHQ ask]" newer_than:60d` (the app's
   *Send to Claude* button mails parked requests to the household inbox).
   Treat each unhandled message as a queue item.
3. Then do whatever the session was opened for.

## Publishing

- Develop on the working branch, run the suite, then fast-forward `main`
  (`git checkout main && git merge --ff-only <branch> && git push origin main`).
  Publishing to `main` is standing permission; opening PRs is not.
- The suite lives in the session scratchpad (`suite.js`, `mk.py`, `errchk.js`,
  `check.js`) and needs `export SP=<scratchpad>` and
  `python3 -m http.server 8765` serving the scratchpad. Rebuild it from the
  earlier session transcript if the scratchpad is gone; do not publish without
  a green run.
- Commit messages: plain description of the change, no model identifiers.

## Data rules

- `seedIds` holds credentials on purpose (household's explicit choice). Leave it.
- Never send the household email address to a third-party service; it is used
  only as the destination of the app's own mailto: link.
- Every figure that came from a document names it (`source:`, `asOf`, notes).
  Unverified numbers carry `confidence:'unconfirmed'` and a `question`.
- When a sweep finds a change, prefer updating the existing row (same `id`) to
  adding a duplicate — `ids` are what the migration merges on.

## Monday routine

A scheduled Claude session runs every Monday at 6am Pacific. It follows this
file, sweeps Gmail for vendors, insurance, subscriptions, appliances, taxes
and equity since the previous Monday, updates the seeds, runs the suite, and
publishes. Anything it cannot finish goes into `PARKING_LOT.md` → Queue.
