# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Three-year revenue projection and product-adoption planner for the **NorCal
account book** (~52 municipal and university parking accounts) at **Arrive
North America**. Account managers use it to model what the book is worth in
2026–2028 under different assumptions: fee increases, adoption ramps, new
product wins, contract ceilings, and renewal risk.

Sister app to the **Flowbird Service Scheduler** (per-trip cost quoting). This
one is portfolio-level revenue, not per-visit cost.

**Owner:** Cristian Shay (non-technical developer). Explain changes in plain
English; avoid jargon.

## Audience & Tone

Users are account managers, not engineers. Keep the UI simple. Projection math
must match what the business actually models — when you change a formula,
document the business rule in a comment so a non-technical reviewer can verify
it without reading code.

## SECURITY — read before deploying

`src/seed.ts` contains **real revenue figures for 52 named accounts**. A
default Vercel deployment is a public URL, and the seed data ships inside the
JavaScript bundle — a client-side password would not help, because anyone who
can load the page can read the data out of the source.

**Vercel Deployment Protection must be ON for Production, not just Preview**
before any production deploy. `vercel.json` sets `X-Robots-Tag: noindex,
nofollow`, but that is hygiene, not access control.

## Commands

```bash
npm run dev        # start Vite dev server with HMR
npm run build      # tsc --noEmit (type check) + vite build
npm run typecheck  # type check only
npm run lint       # oxlint (configured in .oxlintrc.json)
npm run preview    # serve the production build locally
```

No test runner is configured.

## Architecture

Single-page React 18 + TypeScript app built with Vite 5.

**Entry point**: `src/main.tsx` → `src/App.tsx`

Unlike the Flowbird scheduler, this project **does** separate its layers:

```
src/
  types.ts     shared model shapes (16 exported types/interfaces)
  tokens.ts    Arrive palette, type stack, 20px grid
  format.ts    currency, percent and count formatting
  model.ts     the projection: calc, waterfall, elasticity, contracts
  seed.ts      baseline book from NorCal_Client_Book.xlsx (SENSITIVE)
  storage.ts   localStorage persistence with in-memory fallback
  App.tsx      all UI: pages, rail, tables, drawer (~1715 lines)
```

**`model.ts` imports nothing from React.** Keep it that way — it is the pure
projection layer and can be unit-tested or reused by an import/export path
without touching the UI. Never put DOM or React code in it.

### Key business rules in `model.ts`

- **Baseline (year 0) is 2025** (`BASE_YEAR`): live products only, today's fee,
  today's adoption, no growth
- **Adoption ramp** is linear from today toward the Year-3 target (`/ 3` in
  `calc`)
- **Fee elasticity** (default −0.15, relative): a higher app fee pushes sessions
  back to the meter, so raising the fee takes some adoption back. Applied to
  adoption, not to total demand. This is a deliberately conservative starting
  point, not a measured figure.
- **Target products** contribute only from their go-live year, scaled by win
  probability when risk weighting is on
- **Contract NTE ceilings** cap what can be billed
- **Renewal risk** weights revenue from the year *after* a contract ends
- **Order matters**: cap is applied before renewal risk, and the per-product
  split is rescaled afterward so it stays tied to the account total

Six pricing models per product, editable per account: `accountFee` (MPP's own
transaction fee), `perTrx`, `bps` (÷10000 of processed dollars), `flat`,
`pctMpp`, `perStation`.

### Styling

Inline `style` objects using tokens from `src/tokens.ts`. Shared table style
objects **must be annotated `: CSSProperties`** — otherwise TypeScript widens
`textAlign: "right"` to `string` and the build fails with 30+ errors.

### Persistence

Per-browser `localStorage` via `src/storage.ts`, with an in-memory fallback for
Safari private mode and blocked third-party contexts. Two people editing get
two separate books — shared state would need a backend.

`memory` is a module-level `let` in `storage.ts`. That is the intentional
in-memory fallback store, not an accident.

## Deployment

Vercel, configured by `vercel.json` (framework `vite`, output `dist`, security
headers). `npm run build` type-checks first, so a type error fails the build
rather than shipping.
