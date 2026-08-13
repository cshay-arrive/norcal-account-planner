/* The projection model. Nothing here touches the DOM, so it can be tested
   on its own and reused by any importer or export path. */

import type {
  Account, AccountSeed, CalcOpts, Econ, EconModelId, ProductId, ProductState,
  ResolvedEcon, Settings, WaterfallResult, YearResult,
} from "./types";

export const PRODUCTS: ProductId[] = ["MPP", "MOR", "Reservations", "Flowbird", "Insights", "GMP"];
export const SHORT: Record<ProductId, string> = { MPP: "MPP", MOR: "MOR", Reservations: "RES", Flowbird: "FB", Insights: "INS", GMP: "GMP" };
export const STATES: ProductState[] = ["", "TARGET", "LIVE", "N/A"];

export const MODEL_LABEL: Record<EconModelId, string> = {
  accountFee: "per transaction (account fee)",
  perTrx: "$ per MPP transaction",
  bps: "basis points of processed $",
  flat: "$ flat per year",
  pctMpp: "% uplift on MPP revenue",
  perStation: "$ per station per year",
};

export const DEFAULT_ECON: Record<ProductId, Econ> = {
  MPP: { model: "accountFee", rate: 0 },
  MOR: { model: "bps", rate: 25 },
  Reservations: { model: "perTrx", rate: 0.05 },
  Flowbird: { model: "perStation", rate: 720 },
  Insights: { model: "flat", rate: 4800 },
  GMP: { model: "pctMpp", rate: 8 },
};

export const BASE_YEAR = 2025;

/* How far the plan runs. Year 0 is the 2025 baseline, so years 1–3 are the
   projection and Year 3 is the figure every headline quotes. */
export const HORIZON_YEARS = 3;

/* Adoption climbs in equal steps from today to its Year-3 target, so a
   three-year ramp moves a third of the remaining gap each year. Same number as
   HORIZON_YEARS today, but a different rule — shortening the plan and
   shortening the ramp are separate decisions. */
export const RAMP_YEARS = 3;

/* One basis point is a hundredth of a percent, so 10,000 bps is the whole
   amount. Divides processed dollars for the `bps` pricing model. */
export const BPS_PER_UNIT = 10000;

/* Divides a whole-number percentage (a 25% win probability arrives as 25). */
export const PERCENT = 100;

export const DEFAULT_SETTINGS: Settings = {
  feeBump: 0,
  /* Channel substitution: a higher app fee pushes sessions back to the meter.
     Expressed as the relative change in MPP adoption per relative change in fee.
     Parking price elasticities on volume cluster near -0.3; a convenience-fee
     change is smaller and mostly shifts channel rather than destroying demand,
     so -0.15 is a deliberately conservative starting point, not a measured figure. */
  elasticityOn: true,
  feeElasticity: -0.15,
  /* Contracts go back out to procurement. Revenue after the renewal year is
     weighted by the odds of keeping it. */
  renewalRisk: true,
  defaultRenewProb: 85,
  growthDelta: 0,
  adoptionDelta: 0,
  defaultGoLive: 2,
  winProb: 50,
  riskWeight: true,
  econ: DEFAULT_ECON,
};

export function normalize(a: AccountSeed | Account, i: number): Account {
  return {
    id: a.id || `a${i}-${(a.name || "row").slice(0, 8).replace(/\W/g, "")}`,
    name: a.name || "New account",
    zd: !!a.zd,
    products: { ...({ MPP: "", MOR: "", Reservations: "", Flowbird: "", Insights: "", GMP: "" } as Record<ProductId, ProductState>), ...a.products },
    addressable: a.addressable || 0,
    adoptionNow: a.adoptionNow || 0,
    adoptionTarget: a.adoptionTarget || 0,
    avgTrx: a.avgTrx || 0,
    feeNow: a.feeNow || 0,
    feeTarget: a.feeTarget || 0,
    feeYear: a.feeYear || 1,
    growth: a.growth == null ? 0.1 : a.growth,
    fbStations: a.fbStations || 0,
    fbRate: a.fbRate || 720,
    rev25: a.rev25 || 0,
    econ: a.econ || {},
    econModel: a.econModel || {},
    contractEnd: a.contractEnd || "",
    renewProb: a.renewProb == null ? null : a.renewProb,
    nteCap: a.nteCap || 0,
    elasticity: a.elasticity == null ? null : a.elasticity,
    goLive: a.goLive || {},
    winProb: a.winProb == null ? null : a.winProb,
    note: a.note || "",
  };
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/* Pricing for one product at one account: an override beats the book default. */
export function resolveEcon(a: Account, s: Settings, p: ProductId): ResolvedEcon {
  const g = s.econ[p] || { model: "flat", rate: 0 };
  const mo = a.econModel && a.econModel[p];
  const ro = a.econ && a.econ[p];
  const rateSet = typeof ro === "number" && !Number.isNaN(ro);
  return {
    model: mo || g.model,
    rate: rateSet ? Number(ro) : g.rate,
    modelOverridden: !!mo,
    rateOverridden: rateSet,
    bookRate: g.rate,
    bookModel: g.model,
  };
}

/* Unweighted Year 3 value of a product at an account that does not have it,
   as if it went live in Year 1. This is the whitespace figure. */
export function potential(a: Account, s: Settings, p: ProductId): number {
  if (a.products[p] === "LIVE" || a.products[p] === "TARGET") return 0;
  const hyp = { ...a, products: { ...a.products, [p]: "TARGET" }, goLive: { ...a.goLive, [p]: 1 } };
  return calc(hyp, { ...s, riskWeight: false }, HORIZON_YEARS, { renewal: false, cap: false }).byProduct[p];
}

export const hasOverrides = (a: Account): boolean =>
  PRODUCTS.some((p) => typeof a.econ?.[p] === "number" || !!a.econModel?.[p]);

/* Which projection year first carries renewal risk. A contract ending in 2026
   (Year 1) puts Year 2 onward at risk, since the renewal covers what follows. */
export function renewalYear(a: Account): number | null {
  if (!a.contractEnd) return null;
  const yr = parseInt(String(a.contractEnd).slice(0, 4), 10);
  if (!yr || yr < 2000) return null;
  const ry = yr - BASE_YEAR + 1;
  if (ry > HORIZON_YEARS) return null;
  return Math.max(1, ry);
}

/**
 * Revenue for one account in one year.
 * y = 0 is the 2025 baseline: live products only, today's fee, today's adoption, no growth.
 * opts lets the waterfall isolate one driver at a time.
 */
export function calc(a: Account, s: Settings, y: number, opts?: CalcOpts): YearResult {
  const o = { growth: true, fee: true, adoption: true, targets: true, renewal: true, cap: true, ...opts };
  const g = y === 0 ? 0 : (o.growth ? clamp(a.growth + s.growthDelta, -0.5, 2) : 0);
  const addressable = a.addressable * Math.pow(1 + g, y);

  let adoption = a.adoptionNow;
  if (y > 0 && o.adoption) {
    const tgt = clamp(a.adoptionTarget + s.adoptionDelta, 0, 1);
    adoption = clamp(a.adoptionNow + ((tgt - a.adoptionNow) * y) / RAMP_YEARS, 0, 1);
  }

  let fee = a.feeNow;
  let feeRaised = false;
  if (y > 0 && o.fee && y >= a.feeYear) {
    const next = Math.max(a.feeNow, a.feeTarget + s.feeBump);
    feeRaised = next > a.feeNow;
    fee = next;
  }

  /* The fee increase costs some adoption: at a metered curb the alternative
     payment is a few feet away. Applied to adoption, not to total demand. */
  let adoptionLoss = 0;
  if (feeRaised && s.elasticityOn && a.feeNow > 0) {
    const eps = a.elasticity == null ? s.feeElasticity : a.elasticity;
    const relFee = (fee - a.feeNow) / a.feeNow;
    const factor = clamp(1 + eps * relFee, 0, 2);
    adoptionLoss = adoption * (1 - factor);
    adoption = clamp(adoption * factor, 0, 1);
  }

  const mppTrx = addressable * adoption;
  const volume = mppTrx * a.avgTrx;

  const byProduct = {} as Record<ProductId, number>;
  let mppRev = 0;

  const gate = (p: ProductId): number => {
    const st = a.products[p];
    if (st === "LIVE") return 1;
    if (st === "TARGET") {
      if (y === 0 || !o.targets) return 0;
      const live = a.goLive[p] || s.defaultGoLive;
      if (y < live) return 0;
      const wp = a.winProb == null ? s.winProb : a.winProb;
      return s.riskWeight ? clamp(wp / PERCENT, 0, 1) : 1;
    }
    return 0;
  };

  for (const p of PRODUCTS) {
    const w = gate(p);
    if (!w) { byProduct[p] = 0; continue; }
    const e = resolveEcon(a, s, p);
    let v = 0;
    if (p === "MPP" || e.model === "accountFee") v = mppTrx * fee;
    else if (e.model === "perTrx") v = mppTrx * e.rate;
    else if (e.model === "bps") v = (volume * e.rate) / BPS_PER_UNIT;
    else if (e.model === "flat") v = e.rate;
    else if (e.model === "pctMpp") v = (mppRev * e.rate) / PERCENT;
    else if (e.model === "perStation") v = (a.fbStations || 0) * (p === "Flowbird" ? (a.fbRate || e.rate) : e.rate);
    v = v * w;
    byProduct[p] = v;
    if (p === "MPP") mppRev = v;
  }

  const gross = PRODUCTS.reduce((t, p) => t + byProduct[p], 0);
  let total = gross;

  /* Contract not-to-exceed: you cannot bill past the appropriated ceiling. */
  let capped = 0;
  if (o.cap && a.nteCap > 0 && total > a.nteCap) {
    capped = total - a.nteCap;
    total = a.nteCap;
  }

  /* Renewal risk from the year the contract goes back out. */
  let atRisk = 0;
  const ry = renewalYear(a);
  if (o.renewal && s.renewalRisk && ry && y >= ry) {
    const pr = clamp((a.renewProb == null ? s.defaultRenewProb : a.renewProb) / PERCENT, 0, 1);
    atRisk = total * (1 - pr);
    total = total - atRisk;
  }

  /* Keep the per-product split tied to the account total after cap and risk. */
  if (gross > 0 && total !== gross) {
    const scale = total / gross;
    for (const p of PRODUCTS) byProduct[p] = byProduct[p] * scale;
  }

  return { total, gross, byProduct, mppTrx, adoption, adoptionLoss, fee, addressable, volume, capped, atRisk, renewalYear: ry };
}

/* Year 0 (the 2025 baseline) through Year 3, the years every table column and
   projection array is indexed by. */
export const PLAN_YEARS: number[] = Array.from({ length: HORIZON_YEARS + 1 }, (_, y) => y);

export function accountSeries(a: Account, s: Settings): YearResult[] {
  return PLAN_YEARS.map((y) => calc(a, s, y));
}

/** Y3 build-up: what each lever is worth. */
export function waterfall(a: Account, s: Settings): WaterfallResult {
  /* Drivers are isolated before cap and renewal risk, which are reported
     separately so the build-up stays additive. */
  const o = { renewal: false, cap: false };
  const noElastic = { ...s, elasticityOn: false };
  const end = HORIZON_YEARS;
  const base = calc(a, s, 0, o).total;
  const v1 = calc(a, s, end, { ...o, fee: false, adoption: false, targets: false }).total;
  const v2 = calc(a, s, end, { ...o, adoption: false, targets: false }).total;
  const v2gross = calc(a, noElastic, end, { ...o, adoption: false, targets: false }).total;
  const v3 = calc(a, s, end, { ...o, targets: false }).total;
  const v4 = calc(a, s, end, o).total;
  const y3 = calc(a, s, end);
  return {
    base, volume: v1 - base, fee: v2 - v1, adoption: v3 - v2, newProducts: v4 - v3, total: v4,
    feeGross: v2gross - v1, elasticityCost: v2gross - v2,
    atRisk: y3.atRisk, capped: y3.capped, net: y3.total,
  };
}
