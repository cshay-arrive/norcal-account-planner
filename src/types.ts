/* Shared shapes for the account book model. */

export type ProductId = "MPP" | "MOR" | "Reservations" | "Flowbird" | "Insights" | "GMP";
export type ProductState = "" | "TARGET" | "LIVE" | "N/A";
export type EconModelId = "accountFee" | "perTrx" | "bps" | "flat" | "pctMpp" | "perStation";

export interface Econ {
  model: EconModelId;
  rate: number;
}

export interface Account {
  id: string;
  name: string;
  zd: boolean;
  products: Record<ProductId, ProductState>;
  /** Total transactions available at the curb, digital and hardware combined. */
  addressable: number;
  adoptionNow: number;
  adoptionTarget: number;
  avgTrx: number;
  feeNow: number;
  feeTarget: number;
  feeYear: number;
  growth: number;
  fbStations: number;
  fbRate: number;
  /** 2025 revenue as booked, carried from the source workbook. */
  rev25: number;
  /** Per-account rate overrides. Absent means follow the book default. */
  econ: Partial<Record<ProductId, number>>;
  /** Per-account pricing model overrides. */
  econModel: Partial<Record<ProductId, EconModelId>>;
  contractEnd: string;
  renewProb: number | null;
  nteCap: number;
  elasticity: number | null;
  goLive: Partial<Record<ProductId, number>>;
  winProb: number | null;
  note: string;
}

/** What the seed file and any imported row may legally contain. */
export type AccountSeed = Omit<Partial<Account>, "products" | "goLive"> & {
  name: string;
  products?: Partial<Record<ProductId, ProductState>>;
  goLive?: Partial<Record<ProductId, number>>;
};

export interface Settings {
  feeBump: number;
  elasticityOn: boolean;
  feeElasticity: number;
  renewalRisk: boolean;
  defaultRenewProb: number;
  growthDelta: number;
  adoptionDelta: number;
  defaultGoLive: number;
  winProb: number;
  riskWeight: boolean;
  econ: Record<ProductId, Econ>;
}

export type SettingsKey = keyof Settings;

/** Lets the waterfall isolate one driver at a time. */
export interface CalcOpts {
  growth?: boolean;
  fee?: boolean;
  adoption?: boolean;
  targets?: boolean;
  renewal?: boolean;
  cap?: boolean;
}

export interface YearResult {
  total: number;
  gross: number;
  byProduct: Record<ProductId, number>;
  mppTrx: number;
  adoption: number;
  adoptionLoss: number;
  fee: number;
  addressable: number;
  volume: number;
  capped: number;
  atRisk: number;
  renewalYear: number | null;
}

export interface WaterfallResult {
  base: number;
  volume: number;
  fee: number;
  adoption: number;
  newProducts: number;
  total: number;
  feeGross: number;
  elasticityCost: number;
  atRisk: number;
  capped: number;
  net: number;
}

export interface ResolvedEcon {
  model: EconModelId;
  rate: number;
  modelOverridden: boolean;
  rateOverridden: boolean;
  bookRate: number;
  bookModel: EconModelId;
}

export interface AccountRow {
  a: Account;
  series: YearResult[];
  rateSeries: YearResult[];
  wf: WaterfallResult;
}

export interface BuildParts {
  base: number;
  volume: number;
  fee: number;
  adoption: number;
  newProducts: number;
}

/** Book-wide roll-up. Rate figures are measured before cap and renewal risk
    so the blended fee stays a number you could quote. */
export interface Totals {
  years: number[];
  base: number;
  volume: number;
  fee: number;
  adoption: number;
  newProducts: number;
  byProduct: Record<ProductId, number[]>;
  mppTrx: number[];
  mppVolume: number[];
  mppRev: number[];
  atRisk: number[];
  capped: number[];
  feeGross: number;
  elasticityCost: number;
  trxLost: number;
  unknownContracts: number;
}

export interface RenewalBucket {
  y: number | string;
  n: number;
  rev: number;
  warn?: boolean;
}
