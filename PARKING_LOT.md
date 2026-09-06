# Parking lot — instructions for the next Claude Code run

This file is the household's queue for Claude. Anything written here is done
**first** the next time Claude Code opens this repo, before whatever else the
session was started for. The Monday routine reads it the same way.

## How things get here

1. **In the app** — Today → Ask Claude. Type the request, press *Park it*.
   *Send to Claude* mails the open list to the household inbox under the
   subject `[HomeHQ ask] <date>`; Claude searches Gmail for that subject at the
   start of every run. *Copy instead* puts the same brief on the clipboard for
   pasting into a session by hand.
2. **In this file** — add a line under *Queue*. Plain English is fine:
   `- add vendor: Puget Sound Plumbing, 206-555-0100, did the water heater 9/4`
3. **In email** — any message to the household inbox with `[HomeHQ ask]` in
   the subject, from anyone in the household.

## What Claude does with an item

- Reads it, does the work in `index.html` (seeds, suggestions, finance
  constants — whatever the item needs), and runs the suite before publishing.
- Marks the matching Ask Claude entry `done` with a one-paragraph `result`
  (see `seedAsks`) so the app shows what happened.
- Moves the line from *Queue* to *Done* below with the date and the commit.
- If an item cannot be finished (needs a document nobody has, or a decision
  only the household can make), it stays in *Queue* with a note saying exactly
  what is missing — never silently dropped.

## Conventions the app relies on

- Vendors: `{ id:'v-…', company, name, serviceType, phone?, email?, property?, notes }`.
  Use an existing `serviceType` where one fits (HVAC, Appliance repair,
  Electrical, Roof & gutters, General contractor, Pest control, Therapy, …).
- Insurance rows carry `renewalDate` + `premiumCadence`; subscriptions carry
  `cadence` + `renewalDate`; unconfirmed figures get `confidence` + `question`.
- Money that changes the household total lives in the finance constants
  (`PORTFOLIO_DATA`, `BANKING`, `EDUCATION_529`, `EQUITY_COMP`, `MERCURY_EQUITY`,
  `STRIPE_EQUITY`) — and in `HOUSEHOLD_SOURCES()` so its as-of date shows.
- Every open finding becomes a suggestion with `source:` naming the email or
  statement it came from.

## Queue

_(empty — add lines here)_

## Done

- 2026-09-06 — Full Gmail sweep: 16 vendors, Liberty Mutual landlord renewal,
  Skylight/HBO Max/Tumble Creek, Rachio/WhisperKOOL/Fisher & Paykel, maintenance
  cadences, BofA mortgage + side-sewer permit + Sun Valley rental, Stripe
  position ($2.2M) added to the household total, tax calendar, 7 suggestions.
