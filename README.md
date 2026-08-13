# NorCal Account Book Planner

Three-year revenue projection and product-adoption planner for a NorCal
portfolio of ~52 parking accounts. React + TypeScript + Vite.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

```bash
npm install -g vercel   # once
vercel                  # preview
vercel --prod           # production
```

Or push to GitHub and import the repo at vercel.com — the framework is
auto-detected from `vercel.json`.

## READ THIS BEFORE YOU DEPLOY

`src/seed.ts` contains real revenue figures for 52 named municipal and
university accounts. **A default Vercel deployment is a public URL.** Anyone
with the link sees the entire book.

A client-side password would not help: the seed data ships inside the
JavaScript bundle, so anyone who can load the page can read the data straight
out of the source. Protection has to happen at the edge, before the bundle is
served.

Turn on **Vercel Deployment Protection** before your first production deploy:

- Project → Settings → Deployment Protection
- Choose **Vercel Authentication** (your team logs in with their Vercel
  account) or **Password Protection** (single shared password)
- Apply it to **Production** as well as Preview — Vercel defaults to
  protecting previews only

`vercel.json` sets `X-Robots-Tag: noindex, nofollow` so search engines skip
the page, but that is hygiene, not access control.

## Layout

```
src/
  types.ts     shared model shapes
  tokens.ts    Arrive palette, type stack, 20px grid
  format.ts    currency, percent and count formatting
  model.ts     the projection: calc, waterfall, elasticity, contracts
  seed.ts      baseline book from NorCal_Client_Book.xlsx
  storage.ts   localStorage persistence with in-memory fallback
  App.tsx      all UI: pages, rail, tables, drawer
```

The model layer imports nothing from React, so it can be unit-tested or reused
by an import/export path without touching the UI.

## How the projection works

Baseline year 0 is 2025: live products only, today's fee, today's adoption,
no growth. It reconciles to $2,983,620 booked (MPP $2,489,940 + Flowbird
$493,680); the modeled figure runs slightly above because some products sit at
LIVE while carrying no revenue in the source workbook.

Years 1–3 apply, per account:

- **Volume** grows at the account's own rate, compounding
- **Adoption** ramps linearly from today toward its Year-3 target
- **Fee** steps up in whichever year you set
- **Fee elasticity** then takes some adoption back, since a higher app fee
  pushes sessions to the meter a few feet away (default −0.15, relative)
- **Target products** contribute from their go-live year, scaled by win
  probability when risk weighting is on
- **Contract ceilings** cap what can be billed
- **Renewal risk** weights everything from the year after a contract ends

Each product earns differently, editable per account: MPP on the account's own
transaction fee, MOR on basis points of processed dollars, Reservations per
transaction, Flowbird per station per year, Insights as a flat annual licence,
GMP as a percentage of MPP revenue.

## Data entry still owed

No contract end dates are on file. Until they are, renewal risk is zero and
the book projects only upward. The Contracts page ranks accounts by revenue at
stake to make that collection list obvious.

## Notes

- Persistence is per-browser via `localStorage`. Two people editing get two
  separate books. Shared state needs a backend.
- `npm run build` runs `tsc --noEmit` first, so a type error fails the build
  rather than shipping.
- Brand colors are sampled from Arrive Partner Brand Guidelines V1.Q4 2025.
  Mid tones are derived tints, used only for graphs and states.
