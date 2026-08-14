/* DEMO BOOK — invented sample data, safe to publish.
 *
 * This file is compiled into the JavaScript that every visitor downloads, so
 * it must never contain real client names or revenue. The real NorCal book is
 * loaded at runtime with "Load book" from a JSON file kept on your own machine
 * (see private/norcal-book.json, which is gitignored), and is then remembered
 * in that browser.
 *
 * The invented accounts below are deliberately fictional — placeholder city
 * names that do not correspond to any Arrive customer. They are shaped to
 * exercise every feature: live and target products, an account with a contract
 * ending inside the horizon, one with a spending ceiling, one hardware-only
 * site, and one with nothing tracked yet.
 */

import type { AccountSeed } from "./types";

export const SEED: AccountSeed[] = [
  {
    name: "Example City — Downtown",
    zd: true,
    products: { MPP: "LIVE", MOR: "TARGET", Reservations: "", Flowbird: "LIVE", Insights: "TARGET", GMP: "TARGET" },
    addressable: 1200000, adoptionNow: 0.42, adoptionTarget: 0.55, avgTrx: 4.25,
    feeNow: 0.35, feeTarget: 0.45, feeYear: 1, growth: 0.12,
    fbStations: 80, fbRate: 720, rev25: 180000,
    contractEnd: "2027-06-30", renewProb: 80,
  },
  {
    name: "Sample Harbor District",
    zd: true,
    products: { MPP: "LIVE", MOR: "LIVE", Reservations: "TARGET", Flowbird: "", Insights: "", GMP: "TARGET" },
    addressable: 640000, adoptionNow: 0.55, adoptionTarget: 0.68, avgTrx: 3.1,
    feeNow: 0.4, feeTarget: 0.5, feeYear: 2, growth: 0.08,
    fbStations: 0, fbRate: 720, rev25: 96000,
    /* Exercises the not-to-exceed ceiling. */
    nteCap: 150000,
  },
  {
    name: "Placeholder State University",
    zd: false,
    products: { MPP: "LIVE", MOR: "TARGET", Reservations: "", Flowbird: "", Insights: "N/A", GMP: "TARGET" },
    addressable: 410000, adoptionNow: 0.38, adoptionTarget: 0.6, avgTrx: 7.8,
    feeNow: 0.3, feeTarget: 0.4, feeYear: 1, growth: 0.1,
    fbStations: 0, fbRate: 720, rev25: 52000,
    /* Contract ends inside the horizon, so renewal risk applies from Year 2. */
    contractEnd: "2026-12-31", renewProb: 65,
  },
  {
    name: "Demo Transit Authority",
    zd: true,
    products: { MPP: "TARGET", MOR: "", Reservations: "", Flowbird: "TARGET", Insights: "", GMP: "TARGET" },
    addressable: 250000, adoptionNow: 0.1, adoptionTarget: 0.4, avgTrx: 2.4,
    feeNow: 0.25, feeTarget: 0.35, feeYear: 2, growth: 0.15,
    fbStations: 0, fbRate: 720, rev25: 0,
  },
  {
    /* Hardware only — no mobile payments, so it shows the Flowbird-only shape. */
    name: "Testville Airport Lot",
    zd: false,
    products: { MPP: "", MOR: "", Reservations: "", Flowbird: "LIVE", Insights: "", GMP: "" },
    addressable: 0, adoptionNow: 0, adoptionTarget: 0.35, avgTrx: 0,
    feeNow: 0, feeTarget: 0, feeYear: 1, growth: 0.05,
    fbStations: 46, fbRate: 720, rev25: 33120,
  },
  {
    /* Nothing tracked yet — the empty-state row. */
    name: "Anytown Village",
    zd: false,
    products: { MPP: "", MOR: "", Reservations: "", Flowbird: "", Insights: "", GMP: "" },
    addressable: 0, adoptionNow: 0, adoptionTarget: 0.35, avgTrx: 0,
    feeNow: 0, feeTarget: 0, feeYear: 1, growth: 0.08,
    fbStations: 0, fbRate: 720, rev25: 0,
  },
];

/** 2025 revenue as booked for the demo accounts above. */
export const BOOKED_2025 = 361120;

/** Shown in the header while no real book has been loaded. */
export const DEMO_LABEL = "Sample data";
