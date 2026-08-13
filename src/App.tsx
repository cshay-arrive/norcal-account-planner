import React, { useState, useEffect, useMemo, useRef } from "react";
import type { ChangeEvent, CSSProperties, Dispatch, Key, ReactNode, SetStateAction } from "react";

import { BODY, C, DISPLAY, MONO, R, Rsm, U } from "./tokens";
import { cents, cents3, dollars, money, nInt, pct } from "./format";
import { SEED, BOOKED_2025 } from "./seed";
import { loadBook, saveBook, clearBook } from "./storage";
import {
  BASE_YEAR, DEFAULT_ECON, DEFAULT_SETTINGS, MODEL_LABEL, PRODUCTS, SHORT, STATES,
  accountSeries, calc, clamp, hasOverrides, normalize, potential, renewalYear, resolveEcon, waterfall,
} from "./model";
import type {
  Account, AccountRow, BuildParts, EconModelId, ProductId, ProductState,
  RenewalBucket, Settings, SettingsKey, Totals, WaterfallResult, YearResult,
} from "./types";

type Patch = (id: string, fields: Partial<Account>) => void;
/** Transaction-weighted blended rates for one year. */
interface Rate { trx: number; size: number; fee: number; take: number }
interface RateRow { k: string; f: (r: Rate) => string; hint?: string; bold?: boolean }
type OpenMap = Record<string, boolean>;
type SetOpen = Dispatch<SetStateAction<OpenMap>>;

/* ─────────────────────────────  SMALL UI  ───────────────────────────── */
const Label = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, color: C.purple, ...style }}>
    {children}
  </div>
);

/* Info text: smallest in the hierarchy, always black. */
const Info = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontFamily: BODY, fontSize: 11, color: C.muted, ...style }}>{children}</div>
);

/* Arrive's four-point star, tiled as a light background motif. */
const SpacePattern = ({ fill, size = 30, opacity = 1 }: { fill: string; size?: number; opacity?: number }) => (
  <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }} aria-hidden="true">
    <defs>
      <pattern id="arrivestars" width={size} height={size} patternUnits="userSpaceOnUse">
        <path
          d={`M ${size / 2} ${size * 0.12}
              C ${size * 0.54} ${size * 0.38} ${size * 0.62} ${size * 0.46} ${size * 0.88} ${size / 2}
              C ${size * 0.62} ${size * 0.54} ${size * 0.54} ${size * 0.62} ${size / 2} ${size * 0.88}
              C ${size * 0.46} ${size * 0.62} ${size * 0.38} ${size * 0.54} ${size * 0.12} ${size / 2}
              C ${size * 0.38} ${size * 0.46} ${size * 0.46} ${size * 0.38} ${size / 2} ${size * 0.12} Z`}
          fill={fill} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#arrivestars)" />
  </svg>
);

function Chip({ state, onClick, label, title }: {
  state: ProductState; onClick: () => void; label: string; title?: string; key?: Key;
}) {
  const map = {
    LIVE: { bg: C.purple, fg: "#FFFFFF", bd: C.purple, mark: "●" },
    TARGET: { bg: C.pink, fg: C.aubergine, bd: C.pink, mark: "○" },
    "N/A": { bg: C.surface, fg: C.na, bd: C.line, mark: "×" },
    "": { bg: "transparent", fg: "rgba(22,18,26,0.3)", bd: C.line, mark: "·" },
  };
  const m = map[state] || map[""];
  return (
    <button
      onClick={onClick}
      title={title || `${label}: ${state || "not tracked"} — click to change`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer",
        background: m.bg, color: m.fg, border: `1px solid ${m.bd}`,
        borderRadius: Rsm, padding: "3px 6px", minWidth: 46, justifyContent: "center",
        fontFamily: BODY, fontSize: 11, fontWeight: 700, lineHeight: 1.4,
      }}
    >
      <span style={{ fontSize: 9 }}>{m.mark}</span>{label}
    </button>
  );
}

function Num({ value, onChange, step = 1, min, max, prefix, suffix, w = 96 }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
  prefix?: string; suffix?: string; w?: number | string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.line}`, borderRadius: Rsm, background: C.panel, height: 30, width: w }}>
      {prefix && <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, paddingLeft: 6 }}>{prefix}</span>}
      <input
        type="number" value={value} step={step} min={min} max={max}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
        style={{
          border: "none", outline: "none", background: "transparent", width: "100%",
          fontFamily: MONO, fontSize: 12, color: C.ink, padding: "0 6px", textAlign: "right",
        }}
      />
      {suffix && <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, paddingRight: 6 }}>{suffix}</span>}
    </div>
  );
}

function Text({ value, onChange, placeholder, w = "100%" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; w?: number | string;
}) {
  return (
    <input type="text" value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} placeholder={placeholder}
      style={{
        border: `1px solid ${C.line}`, borderRadius: Rsm, background: C.panel, height: 30, width: w,
        fontFamily: BODY, fontSize: 12, color: C.ink, padding: "0 8px", outline: "none",
      }} />
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <Label style={{ fontSize: 11, color: C.ink }}>{label}</Label>
    {children}
    {hint && <Info style={{ fontSize: 10.5 }}>{hint}</Info>}
  </div>
);

function Slider({ label, value, onChange, min, max, step, format }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <Label style={{ fontSize: 11, color: C.ink }}>{label}</Label>
        <span style={{ fontFamily: BODY, fontSize: 12.5, color: C.purple, fontWeight: 700 }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.purple, height: 18 }} />
    </div>
  );
}

/* Signature element: the revenue build shown as containers parked on the grid.
   The container is the brand device; the extended palette is sanctioned for graphs. */
function BuildStrip({ parts, total }: { parts: BuildParts | WaterfallResult; total: number }) {
  const segs = [
    { k: "2025 booked", v: parts.base, fill: C.aubergine, fg: "#fff" },
    { k: "Volume growth", v: parts.volume, fill: C.purple, fg: "#fff" },
    { k: "Fee increases", v: parts.fee, fill: C.midPurple, fg: "#fff" },
    { k: "Adoption lift", v: parts.adoption, fill: C.lightPurple, fg: "#fff" },
    { k: "New products", v: parts.newProducts, fill: C.pink, fg: C.ink },
  ].filter((x) => Math.abs(x.v) > 1);
  const sum = segs.reduce((t, x) => t + Math.max(0, x.v), 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", gap: U / 4, height: 34 }}>
        {segs.map((x) => (
          <div key={x.k} title={`${x.k}: ${dollars(x.v)}`}
            style={{
              flex: `${Math.max(0.6, (Math.max(0, x.v) / sum) * 100)} 1 0`,
              background: x.fill, borderRadius: R, minWidth: 6,
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              paddingRight: 9, overflow: "hidden",
            }}>
            <span style={{ fontFamily: BODY, fontSize: 11, fontWeight: 700, color: x.fg, whiteSpace: "nowrap" }}>
              {(Math.max(0, x.v) / sum) > 0.09 ? money(x.v) : ""}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 9, alignItems: "center" }}>
        {segs.map((x) => (
          <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 16, height: 10, background: x.fill, display: "inline-block", borderRadius: 7, border: x.fill === C.pink ? `1px solid #F58FD2` : "none" }} />
            <span style={{ fontFamily: BODY, fontSize: 11.5, color: C.ink }}>{x.k}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", fontFamily: BODY, fontSize: 11.5, color: C.ink }}>Year 3 · {dollars(total)}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────  ROW DRAWER  ───────────────────────────── */

/* Which inputs belong on which product tab, beyond the shared pricing block. */
const PRODUCT_NOTE = {
  MPP: "Priced from this account's own transaction fee, so the rate fields below are the fee itself.",
  MOR: "Earns on processed dollars, so the average transaction size on the Overview tab drives it.",
  Reservations: "Earns per MPP session. Blend your attach rate into the per-transaction figure.",
  Flowbird: "Earns per station per year. The per-station rate here is already account-specific.",
  Insights: "A flat annual licence. Set the figure this account actually pays.",
  GMP: "Earns as a percentage of this account's MPP revenue, so it moves with adoption and fee.",
};

function TabBar({ tabs, tab, setTab }: {
  tabs: { id: string; label: string; dot?: string }[]; tab: string; setTab: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: U * 0.8 }}>
      {tabs.map((t) => {
        const on = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
              fontFamily: BODY, fontSize: 12, fontWeight: on ? 700 : 400,
              padding: "6px 11px", borderRadius: Rsm,
              background: on ? C.purple : C.panel, color: on ? "#fff" : C.ink,
              border: `1px solid ${on ? C.purple : C.tintDeep}`,
            }}>
            {t.dot && <span style={{ color: on ? "#fff" : t.dot, fontSize: 9 }}>●</span>}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* Pricing block shared by every product tab. */
function ProductPricing({ a, s, p, patch, series }: {
  a: Account; s: Settings; p: ProductId; patch: (fields: Partial<Account>) => void; series: YearResult[];
}) {
  const e = resolveEcon(a, s, p);
  const isMpp = p === "MPP" || e.model === "accountFee";
  const step = e.model === "bps" ? 1 : e.model === "flat" ? 100 : e.model === "pctMpp" ? 0.5 : 0.01;
  const setRate = (v: number) => patch({ econ: { ...a.econ, [p]: v } });
  const clearRate = () => {
    const next = { ...a.econ };
    delete next[p];
    patch({ econ: next });
  };
  const setModel = (v: string) => {
    const next = { ...a.econModel };
    if (v) next[p] = v as EconModelId; else delete next[p];
    patch({ econModel: next });
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: U * 0.7 }}>
        <Field label="How it earns" hint={e.modelOverridden ? `book default is ${MODEL_LABEL[e.bookModel]}` : "following the book default"}>
          <select value={a.econModel[p] || ""} onChange={(ev: ChangeEvent<HTMLSelectElement>) => setModel(ev.target.value)}
            style={{ width: "100%", height: 30, fontFamily: BODY, fontSize: 12, padding: "0 6px", border: `1px solid ${C.line}`, borderRadius: Rsm, background: C.panel, color: C.ink }}>
            <option value="">Book default — {MODEL_LABEL[e.bookModel]}</option>
            {(Object.keys(MODEL_LABEL) as EconModelId[]).map((m) => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}
          </select>
        </Field>

        {isMpp ? (
          <>
            <Field label="Fee now" hint="this account's own rate">
              <Num value={a.feeNow} onChange={(v) => patch({ feeNow: v })} step={0.01} prefix="$" w="100%" />
            </Field>
            <Field label="Fee after increase" hint={s.feeBump ? `+ ${cents(s.feeBump)} book-wide applies` : `+${cents(a.feeTarget - a.feeNow)} vs today`}>
              <Num value={a.feeTarget} onChange={(v) => patch({ feeTarget: v })} step={0.01} prefix="$" w="100%" />
            </Field>
            <Field label="Increase lands in year">
              <Num value={a.feeYear} onChange={(v) => patch({ feeYear: clamp(Math.round(v), 1, 3) })} step={1} min={1} max={3} w="100%" />
            </Field>
          </>
        ) : p === "Flowbird" ? null : (
          <Field
            label={e.model === "flat" ? "Annual cost for this account" : e.model === "bps" ? "Basis points" : e.model === "pctMpp" ? "Percent of MPP revenue" : e.model === "perStation" ? "Per station, per year" : "Per MPP transaction"}
            hint={e.rateOverridden ? `overriding the book default of ${e.model === "bps" ? e.bookRate + " bps" : e.model === "pctMpp" ? e.bookRate + "%" : dollars(e.bookRate)}` : "book default — type here to override"}>
            <Num value={e.rate} onChange={setRate} step={step}
              prefix={e.model === "flat" || e.model === "perTrx" || e.model === "perStation" ? "$" : ""}
              suffix={e.model === "bps" ? "bps" : e.model === "pctMpp" ? "%" : ""} w="100%" />
          </Field>
        )}

        {p === "Flowbird" && (
          <>
            <Field label="Stations">
              <Num value={a.fbStations} onChange={(v) => patch({ fbStations: v })} step={1} w="100%" />
            </Field>
            <Field label="Per station, per year" hint={a.fbStations ? `${dollars(a.fbStations * a.fbRate)} hardware ARR` : "no stations yet"}>
              <Num value={a.fbRate} onChange={(v) => patch({ fbRate: v })} step={10} prefix="$" w="100%" />
            </Field>
          </>
        )}

        <Field label="State" hint={a.products[p] === "TARGET" ? "counts from its go-live year" : a.products[p] === "LIVE" ? "counts in every year" : "contributes nothing"}>
          <select value={a.products[p] || ""} onChange={(ev: ChangeEvent<HTMLSelectElement>) => patch({ products: { ...a.products, [p]: ev.target.value } })}
            style={{ width: "100%", height: 30, fontFamily: BODY, fontSize: 12, padding: "0 6px", border: `1px solid ${C.line}`, borderRadius: Rsm, background: C.panel, color: C.ink }}>
            <option value="">Not tracked</option>
            <option value="TARGET">Target</option>
            <option value="LIVE">Live</option>
            <option value="N/A">N/A</option>
          </select>
        </Field>

        {a.products[p] === "TARGET" && (
          <>
            <Field label="Go live in year">
              <Num value={a.goLive[p] || s.defaultGoLive} onChange={(v) => patch({ goLive: { ...a.goLive, [p]: clamp(Math.round(v), 1, 3) } })} step={1} min={1} max={3} w="100%" />
            </Field>
            <Field label="Win probability" hint={s.riskWeight ? "scales the revenue below" : "risk weighting is off"}>
              <Num value={a.winProb == null ? s.winProb : a.winProb} onChange={(v) => patch({ winProb: clamp(v, 0, 100) })} step={5} suffix="%" w="100%" />
            </Field>
          </>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: C.panel, border: `1px solid ${C.tintDeep}`, borderRadius: Rsm, padding: `${U * 0.4}px ${U * 0.6}px` }}>
        <span style={{ fontFamily: BODY, fontSize: 11.5, color: C.muted }}>Contribution</span>
        {["2025", "Y1", "Y2", "Y3"].map((lab, i) => (
          <span key={lab} style={{ fontFamily: BODY, fontSize: 12 }}>
            <span style={{ color: C.muted }}>{lab} </span>
            <b style={{ color: series[i].byProduct[p] > 0 ? C.ink : C.muted }}>{money(series[i].byProduct[p])}</b>
          </span>
        ))}
        {(e.rateOverridden || e.modelOverridden) && (
          <button onClick={() => { clearRate(); setModel(""); }}
            style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", fontFamily: BODY, fontSize: 11.5, color: C.magenta, padding: 0 }}>
            Revert to book default
          </button>
        )}
      </div>

      <Info style={{ marginTop: U * 0.5 }}>{PRODUCT_NOTE[p]}</Info>
    </div>
  );
}

function Drawer({ a, s, patch }: { a: Account; s: Settings; patch: (fields: Partial<Account>) => void }) {
  const [tab, setTab] = useState<string>("overview");
  const series = accountSeries(a, s);
  const wf = waterfall(a, s);
  const set = (k: keyof Account) => (v: number) => patch({ [k]: v } as Partial<Account>);
  const ry = renewalYear(a);

  const stateColor = (p: ProductId): string => (a.products[p] === "LIVE" ? C.purple : a.products[p] === "TARGET" ? C.magenta : a.products[p] === "N/A" ? C.na : C.line);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "contract", label: "Contract" },
    ...PRODUCTS.map((p) => ({ id: p, label: SHORT[p], dot: stateColor(p) })),
  ];

  return (
    <div style={{
      background: C.tint, borderLeft: `3px solid ${C.purple}`,
      borderTop: `1px solid ${C.pinkSoft}`, padding: `${U * 0.8}px ${U}px ${U}px`,
    }}>
      <TabBar tabs={tabs} tab={tab} setTab={setTab} />

      {tab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: U }}>
            <Field label="Addressable transactions" hint={`${nInt(a.addressable * a.adoptionNow)} on MPP today`}>
              <Num value={a.addressable} onChange={set("addressable")} step={1000} w="100%" />
            </Field>
            <Field label="MPP adoption now" hint={`meter/HW share ${pct(1 - a.adoptionNow)}`}>
              <Num value={a.adoptionNow} onChange={(v) => patch({ adoptionNow: clamp(v, 0, 1) })} step={0.01} min={0} max={1} w="100%" />
            </Field>
            <Field label="MPP adoption target (Y3)" hint={s.adoptionDelta ? `scenario ${s.adoptionDelta > 0 ? "+" : ""}${pct(s.adoptionDelta)}` : "linear ramp over 3 yrs"}>
              <Num value={a.adoptionTarget} onChange={(v) => patch({ adoptionTarget: clamp(v, 0, 1) })} step={0.01} min={0} max={1} w="100%" />
            </Field>
            <Field label="Avg transaction $" hint="drives MOR basis points">
              <Num value={a.avgTrx} onChange={set("avgTrx")} step={0.1} prefix="$" w="100%" />
            </Field>
            <Field label="Transaction growth / yr" hint={s.growthDelta ? `scenario ${pct(a.growth + s.growthDelta, 1)} effective` : "from your trx history"}>
              <Num value={a.growth} onChange={set("growth")} step={0.01} w="100%" />
            </Field>
            <Field label="Fee elasticity override" hint={a.elasticity == null ? `book default ${s.feeElasticity.toFixed(2)}` : "0 makes this account insensitive"}>
              <Num value={a.elasticity == null ? s.feeElasticity : a.elasticity} onChange={(v) => patch({ elasticity: clamp(v, -1, 0) })} step={0.05} w="100%" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: U }}>
            <div>
              <Label style={{ marginBottom: 8 }}>Revenue by product</Label>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: BODY, fontSize: 11.5 }}>
                <thead>
                  <tr style={{ color: C.muted }}>
                    <th style={{ textAlign: "left", padding: "3px 0", fontWeight: 400 }}>Product</th>
                    {["2025", "Y1", "Y2", "Y3"].map((h) => <th key={h} style={{ textAlign: "right", padding: "3px 0", fontWeight: 400 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PRODUCTS.filter((p) => series.some((yr) => yr.byProduct[p] > 0)).map((p) => (
                    <tr key={p} style={{ borderTop: `1px solid ${C.lineSoft}` }}>
                      <td style={{ padding: "3px 0" }}>
                        <button onClick={() => setTab(p)}
                          style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontFamily: BODY, fontSize: 11.5, fontWeight: 500, color: a.products[p] === "LIVE" ? C.purple : C.magenta }}>
                          {p}
                          {(typeof a.econ?.[p] === "number" || !!a.econModel?.[p]) && (
                            <span title="Priced for this account" style={{ color: C.aubergine }}> ✱</span>
                          )}
                        </button>
                      </td>
                      {series.map((yr, i) => <td key={i} style={{ textAlign: "right", padding: "3px 0", color: C.ink }}>{money(yr.byProduct[p])}</td>)}
                    </tr>
                  ))}
                  <tr style={{ borderTop: `1px solid ${C.line}`, fontWeight: 700 }}>
                    <td style={{ padding: "4px 0" }}>Total</td>
                    {series.map((yr, i) => <td key={i} style={{ textAlign: "right", padding: "4px 0" }}>{money(yr.total)}</td>)}
                  </tr>
                  <tr style={{ color: C.muted }}>
                    <td style={{ padding: "3px 0" }}>MPP trx</td>
                    {series.map((yr, i) => <td key={i} style={{ textAlign: "right", padding: "3px 0" }}>{nInt(yr.mppTrx)}</td>)}
                  </tr>
                  <tr style={{ color: C.muted }}>
                    <td style={{ padding: "3px 0" }}>Adoption / fee</td>
                    {series.map((yr, i) => <td key={i} style={{ textAlign: "right", padding: "3px 0" }}>{pct(yr.adoption)} · {cents(yr.fee)}</td>)}
                  </tr>
                  <tr style={{ color: C.muted }}>
                    <td style={{ padding: "3px 0" }}>Take rate of ticket</td>
                    {series.map((yr, i) => <td key={i} style={{ textAlign: "right", padding: "3px 0" }}>{a.avgTrx ? pct(yr.fee / a.avgTrx, 2) : "—"}</td>)}
                  </tr>
                  {series.some((yr) => yr.adoptionLoss > 0) && (
                    <tr style={{ color: C.aubergine }}>
                      <td style={{ padding: "3px 0" }}>Sessions lost to fee</td>
                      {series.map((yr, i) => <td key={i} style={{ textAlign: "right", padding: "3px 0" }}>{yr.adoptionLoss > 0 ? nInt(yr.adoptionLoss * yr.addressable) : "—"}</td>)}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <Label style={{ marginBottom: 8 }}>What drives the Y3 number</Label>
              <BuildStrip parts={wf} total={wf.total} />
              <div style={{ marginTop: 12 }}>
                <Label style={{ fontSize: 11, color: C.ink, marginBottom: 4 }}>Account note</Label>
                <textarea value={a.note} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => patch({ note: e.target.value })}
                  placeholder="Contract terms, rate approval path, who owns the relationship…"
                  style={{
                    width: "100%", minHeight: 54, resize: "vertical", padding: 9, borderRadius: Rsm,
                    border: `1px solid ${C.tintDeep}`, fontFamily: BODY, fontSize: 12.5, color: C.ink, background: C.panel, outline: "none",
                  }} />
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "contract" && (
        <div>
          <Info style={{ marginBottom: U * 0.6 }}>
            {ry
              ? `Contract ends in ${a.contractEnd}; renewal risk applies from Year ${ry}, holding back ${money(series[3].atRisk)} at Year 3.`
              : a.contractEnd
                ? "Ends beyond the three-year horizon, so no renewal risk is modeled."
                : "No end date yet — this account carries no renewal risk until you add one."}
          </Info>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
            <Field label="Contract end" hint="YYYY-MM-DD, or just the year">
              <Text value={a.contractEnd} onChange={(v) => patch({ contractEnd: v })} placeholder="2027-06-30" />
            </Field>
            <Field label="Renewal probability" hint={ry ? `applies from Year ${ry}` : "no renewal in horizon"}>
              <Num value={a.renewProb == null ? s.defaultRenewProb : a.renewProb} onChange={(v) => patch({ renewProb: clamp(v, 0, 100) })} step={5} suffix="%" w="100%" />
            </Field>
            <Field label="Annual not-to-exceed" hint={a.nteCap ? (series[3].capped > 0 ? `Y3 exceeds it by ${money(series[3].capped)}` : "Y3 fits under the ceiling") : "0 for no ceiling"}>
              <Num value={a.nteCap} onChange={(v) => patch({ nteCap: Math.max(0, v) })} step={10000} prefix="$" w="100%" />
            </Field>
          </div>
        </div>
      )}

      {PRODUCTS.includes(tab as ProductId) && (
        <ProductPricing a={a} s={s} p={tab as ProductId} patch={patch} series={series} />
      )}
    </div>
  );
}

/* ─────────────────────────────  PRODUCT PAGE  ───────────────────────────── */
function PageTabs({ page, setPage, accountCount, contractsBadge }: {
  page: string; setPage: (p: string) => void; accountCount: number; contractsBadge: number;
}) {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "accounts", label: "Accounts", n: accountCount },
    { id: "products", label: "Products" },
    { id: "contracts", label: "Contracts", n: contractsBadge, warn: true },
  ];
  return (
    <nav className="headernav">
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", background: C.panel, borderRadius: R, padding: 5 }}>
        {tabs.map((t) => {
          const on = page === t.id;
          return (
            <button key={t.id} onClick={() => setPage(t.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
                fontFamily: BODY, fontSize: 13.5, fontWeight: on ? 700 : 400,
                padding: "10px 18px", borderRadius: Rsm,
                background: on ? C.aubergine : "transparent", color: on ? "#fff" : C.ink, border: "none",
              }}>
              {t.label}
              {t.n != null && (
                <span style={{ fontFamily: BODY, fontSize: 11, fontWeight: 700, color: on ? C.pink : t.warn ? C.aubergine : C.purple }}>{t.n}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* Product picker lives inside the Products page, so the header stays stable
   when the portfolio grows. */
function ProductPicker({ value, setValue, counts, revenue }: {
  value: ProductId; setValue: (p: ProductId) => void;
  counts: Record<ProductId, number>; revenue: Record<ProductId, number>;
}) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: U }}>
      {PRODUCTS.map((p) => {
        const on = value === p;
        return (
          <button key={p} onClick={() => setValue(p)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, cursor: "pointer",
              padding: `${U * 0.45}px ${U * 0.6}px`, borderRadius: R, minWidth: 104,
              background: on ? C.pink : C.panel, border: `1px solid ${on ? C.pink : C.line}`,
            }}>
            <span style={{ fontFamily: BODY, fontSize: 12.5, fontWeight: on ? 700 : 500, color: C.ink }}>{p}</span>
            <span style={{ fontFamily: BODY, fontSize: 11, color: on ? C.midPurple : C.muted }}>
              {counts[p]} live · {money(revenue[p])}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProductPage({ p, rows, s, patch, cycle, setOpen, showAll, setShowAll }: {
  p: ProductId; rows: AccountRow[]; s: Settings; patch: Patch;
  cycle: (id: string, p: ProductId) => void; setOpen: SetOpen;
  showAll: boolean; setShowAll: (v: boolean) => void;
}) {
  const e0 = s.econ[p] || { model: "flat", rate: 0 };
  const isMpp = p === "MPP";
  const isFb = p === "Flowbird";

  const enriched = rows.map((r) => ({
    ...r,
    state: (r.a.products[p] || "") as ProductState,
    rev: [0, 1, 2, 3].map((i) => r.series[i].byProduct[p]),
    up: potential(r.a, s, p),
  }));
  const adopters = enriched.filter((r) => r.state === "LIVE" || r.state === "TARGET").sort((x, y) => y.rev[3] - x.rev[3]);
  const others = enriched.filter((r) => !(r.state === "LIVE" || r.state === "TARGET")).sort((x, y) => y.up - x.up);
  const listed = showAll ? [...adopters, ...others] : adopters;

  const live = enriched.filter((r) => r.state === "LIVE").length;
  const target = enriched.filter((r) => r.state === "TARGET").length;
  const na = enriched.filter((r) => r.state === "N/A").length;
  const untracked = enriched.length - live - target - na;
  const rev = [0, 1, 2, 3].map((i) => enriched.reduce((t, r) => t + r.rev[i], 0));
  const upside = others.reduce((t, r) => t + r.up, 0);
  const bookY3 = enriched.reduce((t, r) => t + r.series[3].total, 0);

  const th: CSSProperties = { textAlign: "right", padding: "9px 10px", fontFamily: BODY, fontSize: 11.5, color: C.muted, fontWeight: 400, whiteSpace: "nowrap" };
  const td: CSSProperties = { textAlign: "right", padding: "7px 10px", fontFamily: BODY, fontSize: 12.5, color: C.ink, whiteSpace: "nowrap" };

  return (
    <div>
      <div style={{ position: "relative", background: C.panel, borderRadius: R, padding: U, marginBottom: U, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.05 }}><SpacePattern fill={C.purple} size={30} /></div>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em" }}>{p}</h2>
            <Info>{MODEL_LABEL[e0.model]}{!isMpp && !isFb ? ` · book default ${e0.model === "bps" ? e0.rate + " bps" : e0.model === "pctMpp" ? e0.rate + "%" : dollars(e0.rate)}` : ""}</Info>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 16, margin: `${U * 0.7}px 0` }}>
            <Kpi label="Live" value={String(live)} note={`${pct(live / (enriched.length || 1))} of the book`} />
            <Kpi label="Target" value={String(target)} note={target ? "in the plan" : "none yet"} />
            <Kpi label="Not tracked" value={String(untracked)} note={`${na} marked N/A`} />
            <Kpi label="Year 3 revenue" value={money(rev[3])} note={`${pct(bookY3 ? rev[3] / bookY3 : 0)} of book Y3`} big />
            <Kpi label="Untapped at Y3" value={money(upside)} note="unweighted, if adopted in Y1" />
          </div>

          <div style={{ display: "flex", height: 22, borderRadius: R, overflow: "hidden", gap: 3 }}>
            {[
              { n: live, fill: C.purple },
              { n: target, fill: C.pink },
              { n: na, fill: C.na },
              { n: untracked, fill: C.line },
            ].filter((x) => x.n > 0).map((x, i) => (
              <div key={i} title={`${x.n} accounts`} style={{ flex: `${x.n} 1 0`, background: x.fill, borderRadius: R }} />
            ))}
          </div>
          <Info style={{ marginTop: 7 }}>
            Adoption across {enriched.length} accounts. Revenue moves from {money(rev[0])} in 2025 to {money(rev[3])} at Year 3.
          </Info>
        </div>
      </div>

      <div style={{ background: C.panel, borderRadius: R, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: `${U / 2}px ${U * 0.6}px`, borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
          <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.purple }}>{p} by account</span>
          <Info>{listed.length} shown{showAll ? "" : " · non-adopters hidden"}</Info>
          <Info style={{ marginLeft: "auto" }}>Rates edit in place and save to the account</Info>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                <th style={{ ...th, textAlign: "left" }}>Account</th>
                <th style={{ ...th, textAlign: "left" }}>State</th>
                <th style={{ ...th, textAlign: "left" }}>{isMpp ? "Fee now / target" : isFb ? "Stations / rate" : "Rate"}</th>
                <th style={th}>2025</th>
                <th style={th}>Y1</th>
                <th style={th}>Y2</th>
                <th style={th}>Y3</th>
                <th style={th}>If adopted</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((r) => {
                const a = r.a;
                const has = r.state === "LIVE" || r.state === "TARGET";
                const e = resolveEcon(a, s, p);
                const setRate = (v: number) => patch(a.id, { econ: { ...a.econ, [p]: v } });
                return (
                  <tr key={a.id} className="rowhover"
                    style={{ borderBottom: `1px solid ${C.lineSoft}`, opacity: has ? 1 : 0.48 }}>
                    <td style={{ padding: "7px 10px", maxWidth: 240 }}>
                      <button onClick={() => setOpen((o) => ({ ...o, [a.id]: true }))}
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, textAlign: "left", fontFamily: BODY, fontSize: 13, color: C.ink }}>
                        {a.name}
                      </button>
                      {e.rateOverridden || e.modelOverridden ? (
                        <span title="Priced for this account" style={{ color: C.aubergine }}> ✱</span>
                      ) : null}
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <Chip state={r.state} label={r.state === "LIVE" ? "Live" : r.state === "TARGET" ? "Target" : r.state === "N/A" ? "N/A" : "Add"} onClick={() => cycle(a.id, p)} />
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      {isMpp ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Num value={a.feeNow} onChange={(v) => patch(a.id, { feeNow: v })} step={0.01} prefix="$" w={82} />
                          <span style={{ color: C.muted, fontSize: 11 }}>&rarr;</span>
                          <Num value={a.feeTarget} onChange={(v) => patch(a.id, { feeTarget: v })} step={0.01} prefix="$" w={82} />
                        </div>
                      ) : isFb ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Num value={a.fbStations} onChange={(v) => patch(a.id, { fbStations: v })} step={1} w={62} />
                          <Num value={a.fbRate} onChange={(v) => patch(a.id, { fbRate: v })} step={10} prefix="$" w={86} />
                        </div>
                      ) : (
                        <Num value={e.rate} onChange={setRate}
                          step={e.model === "bps" ? 1 : e.model === "flat" ? 100 : e.model === "pctMpp" ? 0.5 : 0.01}
                          prefix={e.model === "flat" || e.model === "perTrx" || e.model === "perStation" ? "$" : ""}
                          suffix={e.model === "bps" ? "bps" : e.model === "pctMpp" ? "%" : ""} w={112} />
                      )}
                    </td>
                    {r.rev.map((v, i) => (
                      <td key={i} style={{ ...td, color: i === 0 ? C.muted : C.ink, fontWeight: i === 3 && has ? 700 : 400 }}>
                        {v > 0 ? money(v) : "—"}
                      </td>
                    ))}
                    <td style={{ ...td, color: C.aubergine, fontWeight: r.up > 0 ? 700 : 400 }}>
                      {r.up > 0 ? money(r.up) : "—"}
                    </td>
                  </tr>
                );
              })}
              {listed.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 28, textAlign: "center", color: C.muted, fontSize: 13 }}>
                  No account carries {p} yet. Tick “Show accounts without it” to size the opportunity.
                </td></tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1.5px solid ${C.ink}` }}>
                <td style={{ padding: "10px", fontFamily: BODY, fontSize: 13.5, fontWeight: 700 }}>{p} total</td>
                <td style={{ padding: "10px", fontFamily: BODY, fontSize: 11.5, color: C.muted }}>{live} live · {target} target</td>
                <td />
                {rev.map((v, i) => (
                  <td key={i} style={{ ...td, fontWeight: i === 3 ? 700 : 500, fontSize: 13 }}>{money(v)}</td>
                ))}
                <td style={{ ...td, color: C.aubergine, fontWeight: 700 }}>{money(upside)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ marginTop: U, fontSize: 12.5, color: C.ink, lineHeight: 1.65 }}>
        <strong style={{ color: C.purple, fontWeight: 700 }}>Reading this page.</strong> Greyed rows are accounts without {p} — their
        “If adopted” figure is the unweighted Year 3 value of switching it on in Year 1, which is your whitespace number rather than a
        forecast. Rates edit in place: type a figure and it overrides the book default for that account only. Click any account name to
        open its full drawer.
      </div>
    </div>
  );
}

/* ─────────────────────────────  CONTRACTS PAGE  ───────────────────────────── */
function ContractsPage({ rows, s, patch, setOpen, onlyMissing, setOnlyMissing }: {
  rows: AccountRow[]; s: Settings; patch: Patch; setOpen: SetOpen;
  onlyMissing: boolean; setOnlyMissing: (v: boolean) => void;
}) {
  const enriched = rows.map((r) => {
    const end = r.a.contractEnd;
    const yr = end ? parseInt(String(end).slice(0, 4), 10) : null;
    return { ...r, end, yr: yr && yr > 2000 ? yr : null, ry: renewalYear(r.a), y3: r.series[3].total, risk: r.series[3].atRisk, cap: r.series[3].capped };
  });

  const withDate = enriched.filter((r) => r.yr);
  const missing = enriched.filter((r) => !r.yr).sort((x, y) => y.y3 - x.y3);
  const inHorizon = withDate.filter((r) => r.ry).sort((x, y) => y.risk - x.risk);
  const beyond = withDate.filter((r) => !r.ry).sort((x, y) => y.y3 - x.y3);
  const listed = onlyMissing ? missing : [...inHorizon, ...beyond, ...missing];

  const totalRisk = enriched.reduce((t, r) => t + r.risk, 0);
  const totalCap = enriched.reduce((t, r) => t + r.cap, 0);
  const capped = enriched.filter((r) => r.a.nteCap > 0).length;
  const exposedRevenue = inHorizon.reduce((t, r) => t + r.y3, 0);
  const unknownRevenue = missing.reduce((t, r) => t + r.y3, 0);

  /* Renewal calendar: how much Year 3 revenue sits behind each expiry year. */
  const years = [BASE_YEAR, BASE_YEAR + 1, BASE_YEAR + 2, BASE_YEAR + 3];
  const buckets: RenewalBucket[] = years.map((y) => ({
    y,
    n: withDate.filter((r) => r.yr === y).length,
    rev: withDate.filter((r) => r.yr === y).reduce((t, r) => t + r.y3, 0),
  }));
  buckets.push({
    y: "Later",
    n: withDate.filter((r) => (r.yr ?? 0) > BASE_YEAR + 3).length,
    rev: withDate.filter((r) => (r.yr ?? 0) > BASE_YEAR + 3).reduce((t, r) => t + r.y3, 0),
  });
  buckets.push({ y: "Unknown", n: missing.length, rev: unknownRevenue, warn: true });
  const maxRev = Math.max(...buckets.map((b) => b.rev), 1);

  const th: CSSProperties = { textAlign: "right", padding: "9px 10px", fontFamily: BODY, fontSize: 11.5, color: C.muted, fontWeight: 400, whiteSpace: "nowrap" };
  const td: CSSProperties = { textAlign: "right", padding: "7px 10px", fontFamily: BODY, fontSize: 12.5, color: C.ink, whiteSpace: "nowrap" };

  return (
    <div>
      <div style={{ position: "relative", background: C.panel, borderRadius: R, padding: U, marginBottom: U, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.05 }}><SpacePattern fill={C.purple} size={30} /></div>
        <div style={{ position: "relative" }}>
          <h2 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em" }}>Contracts</h2>
          <Info style={{ marginTop: 3 }}>Renewal risk applies from the year after a contract ends. Ceilings cap what you can bill.</Info>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 16, margin: `${U * 0.7}px 0` }}>
            <Kpi label="End date on file" value={`${withDate.length}/${enriched.length}`} note={`${missing.length} still missing`} />
            <Kpi label="Renewing in horizon" value={String(inHorizon.length)} note={`${money(exposedRevenue)} of Y3 revenue`} />
            <Kpi label="Held back by risk" value={money(totalRisk)} note={s.renewalRisk ? `at ${s.defaultRenewProb}% default odds` : "renewal risk is off"} big />
            <Kpi label="Under a ceiling" value={String(capped)} note={totalCap > 1 ? `${money(totalCap)} over at Y3` : "none exceeded"} />
            <Kpi label="Unpriced risk" value={money(unknownRevenue)} note="revenue with no end date" />
          </div>

          <Label style={{ marginBottom: 8 }}>Renewal calendar</Label>
          <div style={{ display: "flex", gap: U / 3, alignItems: "flex-end", height: 92 }}>
            {buckets.map((b) => (
              <div key={b.y} style={{ flex: "1 1 0", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
                title={`${b.n} accounts · ${dollars(b.rev)} of Year 3 revenue`}>
                <span style={{ fontFamily: BODY, fontSize: 10.5, color: C.muted, textAlign: "center", marginBottom: 3 }}>{b.n || ""}</span>
                <div style={{
                  height: `${Math.max(b.rev > 0 ? 6 : 2, (b.rev / maxRev) * 62)}px`,
                  background: b.warn ? "#CFC7D4" : b.y === BASE_YEAR || b.y === BASE_YEAR + 1 ? C.aubergine : C.purple,
                  borderRadius: R,
                }} />
                <span style={{ fontFamily: BODY, fontSize: 10.5, color: C.ink, textAlign: "center", marginTop: 5 }}>{b.y}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {missing.length > 0 && (
        <div style={{ background: C.pink, borderRadius: R, padding: `${U * 0.6}px ${U * 0.7}px`, marginBottom: U, fontSize: 12.5, color: C.ink }}>
          {missing.length} accounts carrying <b>{money(unknownRevenue)}</b> of Year 3 revenue have no end date, so the model treats them
          as permanent. Start with {missing.slice(0, 3).map((r) => r.a.name.replace("City of ", "")).join(", ")} — the largest exposure.
        </div>
      )}

      <div style={{ background: C.panel, borderRadius: R, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: `${U / 2}px ${U * 0.6}px`, borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
          <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.purple }}>Contract terms by account</span>
          <Info>{listed.length} shown{onlyMissing ? " · missing a date" : ""}</Info>
          <Info style={{ marginLeft: "auto" }}>Everything here edits in place</Info>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                <th style={{ ...th, textAlign: "left" }}>Account</th>
                <th style={{ ...th, textAlign: "left" }}>Contract end</th>
                <th style={{ ...th, textAlign: "left" }}>Risk from</th>
                <th style={{ ...th, textAlign: "left" }}>Renewal odds</th>
                <th style={{ ...th, textAlign: "left" }}>Annual ceiling</th>
                <th style={th}>Y3 revenue</th>
                <th style={th}>Held back</th>
                <th style={th}>Over ceiling</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((r) => {
                const a = r.a;
                return (
                  <tr key={a.id} className="rowhover" style={{ borderBottom: `1px solid ${C.lineSoft}`, opacity: r.ry ? 1 : 0.62 }}>
                    <td style={{ padding: "7px 10px", maxWidth: 230 }}>
                      <button onClick={() => setOpen((o) => ({ ...o, [a.id]: true }))}
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, textAlign: "left", fontFamily: BODY, fontSize: 13, color: C.ink }}>
                        {a.name}
                      </button>
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <Text value={a.contractEnd} onChange={(v) => patch(a.id, { contractEnd: v })} placeholder="2027-06-30" w={124} />
                    </td>
                    <td style={{ padding: "5px 10px", fontFamily: BODY, fontSize: 12, color: r.ry ? C.aubergine : C.muted }}>
                      {r.ry ? `Year ${r.ry}` : r.yr ? "Beyond Y3" : "Not set"}
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <Num value={a.renewProb == null ? s.defaultRenewProb : a.renewProb}
                        onChange={(v) => patch(a.id, { renewProb: clamp(v, 0, 100) })} step={5} suffix="%" w={82} />
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <Num value={a.nteCap} onChange={(v) => patch(a.id, { nteCap: Math.max(0, v) })} step={10000} prefix="$" w={112} />
                    </td>
                    <td style={td}>{money(r.y3)}</td>
                    <td style={{ ...td, color: r.risk > 0 ? C.aubergine : C.muted, fontWeight: r.risk > 0 ? 700 : 400 }}>{r.risk > 0 ? money(r.risk) : "—"}</td>
                    <td style={{ ...td, color: r.cap > 0 ? C.aubergine : C.muted }}>{r.cap > 0 ? money(r.cap) : "—"}</td>
                  </tr>
                );
              })}
              {listed.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 28, textAlign: "center", color: C.muted, fontSize: 13 }}>
                  Every account has an end date on file.
                </td></tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1.5px solid ${C.ink}` }}>
                <td style={{ padding: "10px", fontFamily: BODY, fontSize: 13.5, fontWeight: 700 }}>Total</td>
                <td colSpan={4} style={{ padding: "10px", fontFamily: BODY, fontSize: 11.5, color: C.muted }}>
                  {inHorizon.length} renewing in horizon · {beyond.length} beyond · {missing.length} unknown
                </td>
                <td style={{ ...td, fontWeight: 500, fontSize: 13 }}>{money(enriched.reduce((t, r) => t + r.y3, 0))}</td>
                <td style={{ ...td, color: C.aubergine, fontWeight: 700 }}>{money(totalRisk)}</td>
                <td style={{ ...td, color: C.aubergine, fontWeight: 700 }}>{totalCap > 0 ? money(totalCap) : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ marginTop: U, fontSize: 12.5, color: C.ink, lineHeight: 1.65 }}>
        <strong style={{ color: C.purple, fontWeight: 700 }}>One contract per account is a simplification.</strong> Renewal risk here haircuts
        an account's entire revenue, including products covered by separate agreements. Where a city holds one agreement for mobile payments
        and another for hardware, this overstates the exposure on whichever runs longer.
      </div>
    </div>
  );
}

/* ─────────────────────────────  APP  ───────────────────────────── */
export default function AccountBookPlanner() {
  const [accounts, setAccounts] = useState<Account[]>(() => SEED.map(normalize));
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [open, setOpen] = useState<OpenMap>({});
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<string>("y3");
  const [showEcon, setShowEcon] = useState(false);
  const [showLevers, setShowLevers] = useState(true);
  const [page, setPage] = useState("overview");
  const [showAllOnProduct, setShowAllOnProduct] = useState(true);
  const [productPage, setProductPage] = useState<ProductId>("MPP");
  const [scenarioOpen, setScenarioOpen] = useState(true);
  const [filterProduct, setFilterProduct] = useState<ProductId | "">("");
  const [filterState, setFilterState] = useState<ProductState>("LIVE");
  const [flagFilter, setFlagFilter] = useState<"all" | "overrides" | "nocontract" | "atrisk">("all");
  const [onlyMissingContracts, setOnlyMissingContracts] = useState(false);
  const [status, setStatus] = useState("");
  const loaded = useRef<boolean>(false);

  /* load saved book */
  useEffect(() => {
    (async () => {
      const d = loadBook();
      if (d) {
        if (d.accounts) setAccounts(d.accounts.map(normalize));
        if (d.settings) setS({ ...DEFAULT_SETTINGS, ...d.settings, econ: { ...DEFAULT_ECON, ...(d.settings.econ || {}) } });
        setStatus("Loaded your saved book");
      }
      loaded.current = true;
    })();
  }, []);

  /* save on change, debounced */
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      if (saveBook({ accounts, settings: s })) {
        setStatus("Saved");
        setTimeout(() => setStatus(""), 1400);
      } else {
        setStatus("Kept for this session only");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [accounts, s]);

  /* Scenario takes the rail on Overview; elsewhere it steps back to a summary. */
  useEffect(() => {
    setScenarioOpen(page === "overview");
  }, [page]);

  const patch: Patch = (id, fields) =>
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...fields } : a)));

  const cycle = (id: string, p: ProductId) =>
    setAccounts((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const cur = a.products[p] || "";
      const next = STATES[(STATES.indexOf(cur) + 1) % STATES.length];
      return { ...a, products: { ...a.products, [p]: next } };
    }));

  const addRow = () => {
    const id = `new${Date.now()}`;
    setAccounts((prev) => [
      normalize({
        id, name: "", addressable: 100000, adoptionNow: 0.4, adoptionTarget: 0.55,
        avgTrx: 3.5, feeNow: 0.35, feeTarget: 0.45, feeYear: 1, growth: 0.1,
        products: { MPP: "TARGET", GMP: "TARGET" },
      }, 0),
      ...prev,
    ]);
    setOpen((o) => ({ ...o, [id]: true }));
  };

  const removeRow = (id: string) => setAccounts((prev) => prev.filter((a) => a.id !== id));

  const resetBook = () => {
    setAccounts(SEED.map(normalize));
    setS(DEFAULT_SETTINGS);
    clearBook();
    setStatus("Reset to the spreadsheet numbers");
  };

  /* ── computed ── */
  const rows = useMemo(
    () => accounts.map((a) => ({
      a,
      series: accountSeries(a, s),
      rateSeries: [0, 1, 2, 3].map((y) => calc(a, s, y, { renewal: false, cap: false })),
      wf: waterfall(a, s),
    })),
    [accounts, s]
  );

  const totals = useMemo(() => {
    const t: Totals = {
      years: [0, 0, 0, 0], base: 0, volume: 0, fee: 0, adoption: 0, newProducts: 0,
      byProduct: {} as Record<ProductId, number[]>,
      mppTrx: [0, 0, 0, 0], mppVolume: [0, 0, 0, 0], mppRev: [0, 0, 0, 0],
      atRisk: [0, 0, 0, 0], capped: [0, 0, 0, 0],
      feeGross: 0, elasticityCost: 0, trxLost: 0, unknownContracts: 0,
    };
    for (const p of PRODUCTS) t.byProduct[p] = [0, 0, 0, 0];
    /* Rate inputs cover accounts where MPP is live, so the blended figures are
       the ones you could actually quote — no risk-weighted pipeline in the mix. */
    for (const r of rows) {
      const liveMpp = r.a.products.MPP === "LIVE" && r.a.addressable > 0;
      if (!r.a.contractEnd) t.unknownContracts += 1;
      t.feeGross += r.wf.feeGross;
      t.elasticityCost += r.wf.elasticityCost;
      r.series.forEach((yr, i) => {
        t.years[i] += yr.total;
        t.atRisk[i] += yr.atRisk;
        t.capped[i] += yr.capped;
        for (const p of PRODUCTS) t.byProduct[p][i] += yr.byProduct[p];
        if (liveMpp) {
          /* Rates are quoted before cap and renewal weighting, so the blended
             fee stays a number you could put in front of a customer. */
          const q = r.rateSeries[i];
          t.mppTrx[i] += q.mppTrx;
          t.mppVolume[i] += q.volume;
          t.mppRev[i] += q.byProduct.MPP;
          if (i === 3) t.trxLost += (q.adoptionLoss || 0) * q.addressable;
        }
      });
      t.base += r.wf.base; t.volume += r.wf.volume; t.fee += r.wf.fee;
      t.adoption += r.wf.adoption; t.newProducts += r.wf.newProducts;
    }
    return t;
  }, [rows]);

  const levers = useMemo(() => {
    const out = [];
    for (const r of rows) {
      for (const p of PRODUCTS) {
        if (r.a.products[p] === "TARGET" && r.series[3].byProduct[p] > 0) {
          out.push({ kind: p, name: r.a.name, value: r.series[3].byProduct[p], id: r.a.id });
        }
      }
      if (r.wf.fee > 0) out.push({ kind: "Fee increase", name: r.a.name, value: r.wf.fee, id: r.a.id });
      if (r.wf.adoption > 0) out.push({ kind: "Adoption lift", name: r.a.name, value: r.wf.adoption, id: r.a.id });
    }
    return out.sort((x, y) => y.value - x.value).slice(0, 12);
  }, [rows]);

  const expiring = useMemo(
    () => rows.filter((r) => renewalYear(r.a)).sort((x, y) => y.series[3].atRisk - x.series[3].atRisk),
    [rows]
  );

  const visible = useMemo(() => {
    const f = rows.filter((r) => {
      if (!r.a.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (filterProduct && (r.a.products[filterProduct] || "") !== filterState) return false;
      if (flagFilter === "overrides" && !hasOverrides(r.a)) return false;
      if (flagFilter === "nocontract" && r.a.contractEnd) return false;
      if (flagFilter === "atrisk" && !(renewalYear(r.a) && r.series[3].atRisk > 0)) return false;
      return true;
    });
    const keys: Record<string, (r: AccountRow) => number | string> = {
      y3: (r) => -r.series[3].total,
      base: (r) => -r.series[0].total,
      delta: (r) => -(r.series[3].total - r.series[0].total),
      upside: (r) => -r.wf.newProducts,
      name: (r) => r.a.name.toLowerCase(),
    };
    const key = keys[sortKey] ?? keys.y3;
    return f.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0));
  }, [rows, q, sortKey, filterProduct, filterState, flagFilter]);

  const exportCsv = () => {
    const head = ["Account", ...PRODUCTS, "2025", "Year 1", "Year 2", "Year 3", "Growth $", "Growth %",
      "Addressable trx", "Adoption now", "Adoption Y3", "Fee now", "Fee target", "Fee year", "Trx growth", "FB stations", "FB rate",
      "Contract end", "Renewal prob", "NTE cap", "Fee elasticity", "Y3 held back", "Y3 over ceiling", "Pricing overrides", "Note"];
    const lines = [head.join(",")];
    for (const r of rows) {
      const { a, series } = r;
      const g = series[3].total - series[0].total;
      lines.push([
        `"${a.name.replace(/"/g, '""')}"`, ...PRODUCTS.map((p) => a.products[p] || ""),
        series[0].total.toFixed(0), series[1].total.toFixed(0), series[2].total.toFixed(0), series[3].total.toFixed(0),
        g.toFixed(0), series[0].total ? (g / series[0].total).toFixed(3) : "",
        a.addressable, a.adoptionNow, a.adoptionTarget, a.feeNow, a.feeTarget, a.feeYear, a.growth,
        a.fbStations, a.fbRate,
        a.contractEnd, a.renewProb == null ? s.defaultRenewProb : a.renewProb, a.nteCap,
        a.elasticity == null ? s.feeElasticity : a.elasticity,
        series[3].atRisk.toFixed(0), series[3].capped.toFixed(0),
        `"${PRODUCTS.filter((p) => typeof a.econ?.[p] === "number" || !!a.econModel?.[p])
          .map((p) => `${p}=${resolveEcon(a, s, p).model}:${resolveEcon(a, s, p).rate}`).join("; ")}"`,
        `"${(a.note || "").replace(/"/g, '""')}"`,
      ].join(","));
    }
    lines.push(["TOTAL", "", "", "", "", "", "", ...totals.years.map((v) => v.toFixed(0))].join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url; link.download = "norcal_book_projection.csv"; link.click();
    URL.revokeObjectURL(url);
  };

  const overrideCount = useMemo(() => {
    const c = {} as Record<ProductId, number>;
    for (const p of PRODUCTS) {
      c[p] = accounts.filter((a) => typeof a.econ?.[p] === "number" || !!a.econModel?.[p]).length;
    }
    return c;
  }, [accounts]);

  const liveCounts = useMemo(() => {
    const c = {} as Record<ProductId, number>;
    for (const q of PRODUCTS) c[q] = accounts.filter((a) => a.products[q] === "LIVE").length;
    return c;
  }, [accounts]);

  const activeLevers = useMemo(() => {
    const out = [];
    if (s.feeBump) out.push(`+${cents(s.feeBump)} fee`);
    if (s.growthDelta) out.push(`${s.growthDelta > 0 ? "+" : ""}${pct(s.growthDelta)} volume`);
    if (s.adoptionDelta) out.push(`${s.adoptionDelta > 0 ? "+" : ""}${pct(s.adoptionDelta)} adoption`);
    if (s.defaultGoLive !== DEFAULT_SETTINGS.defaultGoLive) out.push(`targets Y${s.defaultGoLive}`);
    if (s.winProb !== DEFAULT_SETTINGS.winProb) out.push(`${s.winProb}% win`);
    if (!s.riskWeight) out.push("unweighted targets");
    if (!s.elasticityOn) out.push("no fee elasticity");
    else if (s.feeElasticity !== DEFAULT_SETTINGS.feeElasticity) out.push(`elasticity ${s.feeElasticity.toFixed(2)}`);
    if (!s.renewalRisk) out.push("no renewal risk");
    else if (s.defaultRenewProb !== DEFAULT_SETTINGS.defaultRenewProb) out.push(`${s.defaultRenewProb}% renewal`);
    return out;
  }, [s]);

  const leverKeys: SettingsKey[] = ["feeBump", "growthDelta", "adoptionDelta", "defaultGoLive", "winProb",
    "riskWeight", "elasticityOn", "feeElasticity", "renewalRisk", "defaultRenewProb"];
  const leversTouched = leverKeys.filter((k) => s[k] !== DEFAULT_SETTINGS[k]).length;
  const resetLevers = () =>
    setS({ ...s, ...(Object.fromEntries(leverKeys.map((k) => [k, DEFAULT_SETTINGS[k]])) as Partial<Settings>) });

  /* Transaction-weighted, so a big account moves the blend more than a small one. */
  const rates: Rate[] = [0, 1, 2, 3].map((i) => {
    const trx = totals.mppTrx[i];
    const size = trx ? totals.mppVolume[i] / trx : 0;
    const fee = trx ? totals.mppRev[i] / trx : 0;
    return { trx, size, fee, take: size ? fee / size : 0 };
  });

  const growthPct = totals.years[0] ? (totals.years[3] - totals.years[0]) / totals.years[0] : 0;
  const cagr = totals.years[0] > 0 ? Math.pow(totals.years[3] / totals.years[0], 1 / 3) - 1 : 0;
  const unpriced = totals.years[0] - BOOKED_2025;

  const th: CSSProperties = { textAlign: "right", padding: "9px 10px", fontFamily: BODY, fontSize: 11.5, color: C.muted, fontWeight: 400, whiteSpace: "nowrap", cursor: "pointer" };
  const td: CSSProperties = { textAlign: "right", padding: "8px 10px", fontFamily: BODY, fontSize: 12.5, color: C.ink, whiteSpace: "nowrap" };

  return (
    <div style={{ background: C.ground, minHeight: "100vh", fontFamily: BODY, color: C.ink }}>
      <style>{`
        * { box-sizing: border-box; font-variant-numeric: tabular-nums; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.35; }
        button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid ${C.magenta}; outline-offset: 2px; }
        .rowhover:hover { background: ${C.tint}; }
        .shell { display: grid; grid-template-columns: 286px minmax(0, 1fr); gap: ${U}px; align-items: start; }
        .rail { position: sticky; top: ${U}px; max-height: calc(100vh - ${U * 2}px); overflow-y: auto; overscroll-behavior: contain; }
        .rail::-webkit-scrollbar { width: 6px; }
        .rail::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 3px; }
        .railtoggle { display: none; }
        .headernav { position: sticky; top: 0; z-index: 20; padding: ${U / 2}px 0 ${U}px; background: linear-gradient(${C.ground} 76%, rgba(244,242,245,0)); }
        @media (max-width: 940px) {
          .shell { grid-template-columns: minmax(0, 1fr); }
          .rail { position: static; max-height: none; }
          .railtoggle { display: inline-flex; }
        }
        @media (prefers-reduced-motion: no-preference) { .rowhover { transition: background 120ms ease; } }
      `}</style>

      <div style={{ maxWidth: 1420, margin: "0 auto", padding: `${U}px ${U}px ${U * 3}px` }}>

        {/* ── masthead ── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: U }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 38, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
                Account book planner
              </h1>
              <span style={{ fontFamily: BODY, fontSize: 12, color: C.muted }}>NorCal · {accounts.length} accounts</span>
            </div>
            <div style={{ fontSize: 13.5, color: C.ink, marginTop: 6, maxWidth: 620 }}>
              Change a number, a product state, or a scenario lever. The three-year projection re-rolls as you type.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: BODY, fontSize: 11.5, fontWeight: 700, color: C.purple, minWidth: 60 }}>{status}</span>
            <button onClick={addRow} style={btn(true)}>Add account</button>
            <button onClick={exportCsv} style={btn()}>Export CSV</button>
            <button onClick={resetBook} style={btn()}>Reset</button>
          </div>
        </div>

        <PageTabs page={page} setPage={setPage} accountCount={accounts.length}
          contractsBadge={expiring.length || totals.unknownContracts} />

        <div className="shell">

          {/* ── left rail: scenario levers, filter-panel style ── */}
          <aside className="rail">

            {/* Scenario assumptions travel with you, but only take the whole rail
                on Overview where the book-level story is the point. */}
            <div style={{ background: C.panel, borderRadius: R, padding: U, marginBottom: U }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: BODY, fontSize: 14.5, fontWeight: 700, color: C.purple }}>Scenario</span>
                {leversTouched > 0 && (
                  <button onClick={resetLevers}
                    style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: BODY, fontSize: 11.5, color: C.magenta, padding: 0 }}>
                    Reset {leversTouched}
                  </button>
                )}
              </div>

              {scenarioOpen ? (
                <>
                  <Info style={{ marginBottom: U * 0.8 }}>Applied to every account on top of its own numbers.</Info>
                  <div style={{ display: "flex", flexDirection: "column", gap: U * 0.8 }}>
                    <Slider label="Fee increase, book-wide" value={s.feeBump} min={0} max={0.25} step={0.01}
                      onChange={(v) => setS({ ...s, feeBump: v })} format={(v) => `+${cents(v)} / trx`} />
                    <Slider label="Transaction volume growth" value={s.growthDelta} min={-0.15} max={0.25} step={0.01}
                      onChange={(v) => setS({ ...s, growthDelta: v })} format={(v) => `${v >= 0 ? "+" : ""}${pct(v, 0)} vs plan`} />
                    <Slider label="MPP adoption target lift" value={s.adoptionDelta} min={-0.2} max={0.4} step={0.01}
                      onChange={(v) => setS({ ...s, adoptionDelta: v })} format={(v) => `${v >= 0 ? "+" : ""}${pct(v, 0)} pts`} />
                    <Slider label="Targets go live in year" value={s.defaultGoLive} min={1} max={3} step={1}
                      onChange={(v) => setS({ ...s, defaultGoLive: v })} format={(v) => `Year ${v}`} />
                    <Slider label="Win probability on targets" value={s.winProb} min={0} max={100} step={5}
                      onChange={(v) => setS({ ...s, winProb: v })} format={(v) => `${v}%`} />
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", marginTop: U * 0.8, paddingTop: U * 0.6, borderTop: `1px solid ${C.lineSoft}` }}>
                    <input type="checkbox" checked={s.riskWeight} onChange={(e: ChangeEvent<HTMLInputElement>) => setS({ ...s, riskWeight: e.target.checked })} />
                    Risk-weight target products
                  </label>

                  <div style={{ marginTop: U * 0.6, paddingTop: U * 0.6, borderTop: `1px solid ${C.lineSoft}` }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", marginBottom: s.elasticityOn ? U * 0.6 : 0 }}>
                      <input type="checkbox" checked={s.elasticityOn} onChange={(e: ChangeEvent<HTMLInputElement>) => setS({ ...s, elasticityOn: e.target.checked })} />
                      Fee costs adoption
                    </label>
                    {s.elasticityOn && (
                      <>
                        <Slider label="Adoption elasticity to fee" value={s.feeElasticity} min={-0.6} max={0} step={0.05}
                          onChange={(v) => setS({ ...s, feeElasticity: v })} format={(v) => v.toFixed(2)} />
                        <Info style={{ fontSize: 10.5, marginTop: 4 }}>
                          A 50% fee rise moves adoption {pct(Math.abs(s.feeElasticity) * 0.5, 1)} lower, relative.
                        </Info>
                      </>
                    )}
                  </div>

                  {page !== "overview" && (
                    <button onClick={() => setScenarioOpen(false)}
                      style={{ ...btn(), width: "100%", marginTop: U * 0.7 }}>Collapse scenario</button>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: U * 0.6 }}>
                    {activeLevers.length === 0 ? (
                      <Info>Book defaults, nothing overridden.</Info>
                    ) : activeLevers.map((l) => (
                      <span key={l} style={{ fontFamily: BODY, fontSize: 11, fontWeight: 700, color: C.ink, background: C.pink, borderRadius: Rsm, padding: "3px 7px" }}>{l}</span>
                    ))}
                  </div>
                  <div style={{ fontFamily: BODY, fontSize: 12.5, color: C.ink, marginBottom: U * 0.6 }}>
                    Year 3 <b>{money(totals.years[3])}</b> <span style={{ color: C.muted }}>· {pct(growthPct)} over 2025</span>
                  </div>
                  <button onClick={() => setScenarioOpen(true)} style={{ ...btn(), width: "100%" }}>Adjust assumptions</button>
                </>
              )}
            </div>

            {/* ── Overview: the book's pricing defaults ── */}
            {page === "overview" && (
              <div style={{ background: C.panel, borderRadius: R, padding: U, marginBottom: U }}>
                <span style={{ fontFamily: BODY, fontSize: 14.5, fontWeight: 700, color: C.purple }}>Product economics</span>
                <Info style={{ marginTop: 2, marginBottom: U * 0.6 }}>Book defaults. Override per account on any product page.</Info>
                <div style={{ display: "flex", flexDirection: "column", gap: U * 0.5 }}>
                  {PRODUCTS.map((q) => {
                    const e = s.econ[q];
                    const locked = q === "MPP" || e.model === "accountFee";
                    return (
                      <div key={q} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: C.tint, borderRadius: Rsm, padding: `${U * 0.35}px ${U * 0.5}px` }}>
                        <button onClick={() => { setPage("products"); setProductPage(q); }}
                          style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, textAlign: "left", fontFamily: BODY, fontSize: 12.5, fontWeight: 700, color: C.ink }}>
                          {q}
                          {overrideCount[q] > 0 && <span style={{ color: C.aubergine }}> ✱{overrideCount[q]}</span>}
                        </button>
                        <span style={{ fontFamily: BODY, fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }}>
                          {locked ? "account fee" : e.model === "bps" ? `${e.rate} bps` : e.model === "pctMpp" ? `${e.rate}%` : e.model === "flat" ? dollars(e.rate) : e.model === "perStation" ? `${dollars(e.rate)}/st` : cents(e.rate)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Accounts: filters ── */}
            {page === "accounts" && (
              <div style={{ background: C.panel, borderRadius: R, padding: U, marginBottom: U }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: BODY, fontSize: 14.5, fontWeight: 700, color: C.purple }}>Filter accounts</span>
                  {(q || filterProduct || flagFilter !== "all") && (
                    <button onClick={() => { setQ(""); setFilterProduct(""); setFilterState("LIVE"); setFlagFilter("all"); }}
                      style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: BODY, fontSize: 11.5, color: C.magenta, padding: 0 }}>
                      Clear
                    </button>
                  )}
                </div>
                <Info style={{ marginBottom: U * 0.7 }}>{visible.length} of {accounts.length} shown</Info>

                <div style={{ display: "flex", flexDirection: "column", gap: U * 0.7 }}>
                  <Field label="Search by name">
                    <Text value={q} onChange={setQ} placeholder="Sacramento" />
                  </Field>

                  <div>
                    <Label style={{ fontSize: 11, color: C.ink, marginBottom: 4 }}>Sort by</Label>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {[["y3", "Year 3"], ["base", "2025"], ["delta", "Growth $"], ["upside", "Product upside"], ["name", "A–Z"]].map(([k, lab]) => (
                        <button key={k} onClick={() => setSortKey(k)} style={pill(sortKey === k)}>{lab}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Field label="Product">
                      <select value={filterProduct} onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterProduct(e.target.value as ProductId | "")}
                        style={{ width: "100%", height: 30, fontFamily: BODY, fontSize: 12, padding: "0 6px", border: `1px solid ${C.line}`, borderRadius: Rsm, background: C.panel, color: C.ink }}>
                        <option value="">Any</option>
                        {PRODUCTS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </Field>
                    <Field label="Is">
                      <select value={filterState} onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterState(e.target.value as ProductState)} disabled={!filterProduct}
                        style={{ width: "100%", height: 30, fontFamily: BODY, fontSize: 12, padding: "0 6px", border: `1px solid ${C.line}`, borderRadius: Rsm, background: filterProduct ? C.panel : C.tint, color: C.ink }}>
                        <option value="LIVE">Live</option>
                        <option value="TARGET">Target</option>
                        <option value="N/A">N/A</option>
                        <option value="">Not tracked</option>
                      </select>
                    </Field>
                  </div>

                  <div>
                    <Label style={{ fontSize: 11, color: C.ink, marginBottom: 4 }}>Needs attention</Label>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {[["all", "All"], ["overrides", "Priced separately"], ["nocontract", "No contract date"], ["atrisk", "Renewal risk"]].map(([k, lab]) => (
                        <button key={k} onClick={() => setFlagFilter(k as typeof flagFilter)} style={pill(flagFilter === k)}>{lab}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Products: pricing and view for the product in view ── */}
            {page === "products" && (
              <div style={{ background: C.panel, borderRadius: R, padding: U, marginBottom: U }}>
                <span style={{ fontFamily: BODY, fontSize: 14.5, fontWeight: 700, color: C.purple }}>{productPage} pricing</span>
                <Info style={{ marginTop: 2, marginBottom: U * 0.7 }}>
                  The book default. {overrideCount[productPage] > 0
                    ? `${overrideCount[productPage]} account${overrideCount[productPage] > 1 ? "s" : ""} priced separately.`
                    : "No account overrides yet."}
                </Info>

                {(() => {
                  const e = s.econ[productPage];
                  const locked = productPage === "MPP" || e.model === "accountFee";
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: U * 0.7 }}>
                      <Field label="How it earns">
                        <select value={e.model} onChange={(ev: ChangeEvent<HTMLSelectElement>) => setS({ ...s, econ: { ...s.econ, [productPage]: { ...e, model: ev.target.value } } })}
                          style={{ width: "100%", height: 30, fontFamily: BODY, fontSize: 12, padding: "0 6px", border: `1px solid ${C.line}`, borderRadius: Rsm, background: C.panel, color: C.ink }}>
                          {(Object.keys(MODEL_LABEL) as EconModelId[]).map((m) => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}
                        </select>
                      </Field>
                      {locked ? (
                        <Info>Priced from each account's own transaction fee, so there is no book rate to set.</Info>
                      ) : (
                        <Field label={e.model === "flat" ? "Annual licence" : e.model === "bps" ? "Basis points" : e.model === "pctMpp" ? "Percent of MPP revenue" : e.model === "perStation" ? "Per station, per year" : "Per MPP transaction"}
                          hint={`Y3 contribution ${money(totals.byProduct[productPage][3])}`}>
                          <Num value={e.rate} onChange={(v) => setS({ ...s, econ: { ...s.econ, [productPage]: { ...e, rate: v } } })}
                            step={e.model === "bps" ? 1 : e.model === "flat" ? 100 : e.model === "pctMpp" ? 0.5 : 0.01}
                            prefix={e.model === "flat" || e.model === "perTrx" || e.model === "perStation" ? "$" : ""}
                            suffix={e.model === "bps" ? "bps" : e.model === "pctMpp" ? "%" : ""} w="100%" />
                        </Field>
                      )}
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", paddingTop: U * 0.5, borderTop: `1px solid ${C.lineSoft}` }}>
                        <input type="checkbox" checked={showAllOnProduct} onChange={(ev: ChangeEvent<HTMLInputElement>) => setShowAllOnProduct(ev.target.checked)} />
                        Show accounts without it
                      </label>
                      <Info style={{ fontSize: 10.5 }}>Greyed rows carry an “if adopted” figure instead of revenue.</Info>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Contracts: renewal assumptions ── */}
            {page === "contracts" && (
              <div style={{ background: C.panel, borderRadius: R, padding: U, marginBottom: U }}>
                <span style={{ fontFamily: BODY, fontSize: 14.5, fontWeight: 700, color: C.purple }}>Renewal assumptions</span>
                <Info style={{ marginTop: 2, marginBottom: U * 0.7 }}>
                  {totals.unknownContracts} of {accounts.length} accounts have no end date, so they carry no risk yet.
                </Info>
                <div style={{ display: "flex", flexDirection: "column", gap: U * 0.7 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={s.renewalRisk} onChange={(e: ChangeEvent<HTMLInputElement>) => setS({ ...s, renewalRisk: e.target.checked })} />
                    Weight for renewal risk
                  </label>
                  {s.renewalRisk && (
                    <>
                      <Slider label="Default renewal probability" value={s.defaultRenewProb} min={40} max={100} step={5}
                        onChange={(v) => setS({ ...s, defaultRenewProb: v })} format={(v) => `${v}%`} />
                      <Info style={{ fontSize: 10.5 }}>Applies from the year after each contract ends. Per-account odds override it.</Info>
                    </>
                  )}
                  <div style={{ paddingTop: U * 0.5, borderTop: `1px solid ${C.lineSoft}` }}>
                    <div style={{ fontFamily: BODY, fontSize: 12.5, color: C.ink }}>
                      Held back at Y3 <b style={{ color: C.aubergine }}>{money(totals.atRisk[3])}</b>
                    </div>
                    <div style={{ fontFamily: BODY, fontSize: 12.5, color: C.ink, marginTop: 3 }}>
                      Over ceilings <b style={{ color: C.aubergine }}>{totals.capped[3] > 0 ? money(totals.capped[3]) : "none"}</b>
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", paddingTop: U * 0.5, borderTop: `1px solid ${C.lineSoft}` }}>
                    <input type="checkbox" checked={onlyMissingContracts} onChange={(ev: ChangeEvent<HTMLInputElement>) => setOnlyMissingContracts(ev.target.checked)} />
                    Only accounts missing a date
                  </label>
                </div>
              </div>
            )}

          </aside>

          {/* ── right column ── */}
          <div>

        {page === "contracts" && (
          <ContractsPage rows={rows} s={s} patch={patch} setOpen={setOpen}
            onlyMissing={onlyMissingContracts} setOnlyMissing={setOnlyMissingContracts} />
        )}

        {page === "products" && (
          <>
            <ProductPicker value={productPage} setValue={setProductPage} counts={liveCounts}
              revenue={PRODUCTS.reduce((acc, q) => { acc[q] = totals.byProduct[q][3]; return acc; }, {} as Record<ProductId, number>)} />
            <ProductPage p={productPage} rows={rows} s={s} patch={patch} cycle={cycle} setOpen={setOpen}
              showAll={showAllOnProduct} setShowAll={setShowAllOnProduct} />
          </>
        )}

        {page === "accounts" && (
          <>
        {/* ── table ── */}
        <div style={{ background: C.panel, borderRadius: R, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: `${U / 2}px ${U * 0.6}px`, borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
            <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.purple }}>
              {visible.length === accounts.length ? "All accounts" : `${visible.length} of ${accounts.length} accounts`}
            </span>
            {(q || filterProduct || flagFilter !== "all") && (
              <span style={{ fontFamily: BODY, fontSize: 11.5, color: C.muted }}>
                filtered{filterProduct ? ` · ${filterProduct} ${filterState || "not tracked"}` : ""}{flagFilter !== "all" ? ` · ${flagFilter === "overrides" ? "priced separately" : flagFilter === "nocontract" ? "no contract date" : "renewal risk"}` : ""}
              </span>
            )}
            <div style={{ display: "flex", gap: 12, marginLeft: "auto", fontFamily: BODY, fontSize: 11.5, color: C.ink }}>
              <span><b style={{ color: C.purple }}>●</b> Live</span><span><b style={{ color: C.magenta }}>○</b> Target</span><span style={{ color: C.muted }}>× N/A</span>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.line}`, background: C.panel }}>
                  <th style={{ ...th, textAlign: "left", cursor: "default" }}>Account</th>
                  <th style={{ ...th, textAlign: "left", cursor: "default" }}>Products</th>
                  <th style={th} onClick={() => setSortKey("base")}>2025</th>
                  <th style={th} onClick={() => setSortKey("y3")}>Y1</th>
                  <th style={th} onClick={() => setSortKey("y3")}>Y2</th>
                  <th style={th} onClick={() => setSortKey("y3")}>Y3</th>
                  <th style={th} onClick={() => setSortKey("delta")}>Growth</th>
                  <th style={{ ...th, cursor: "default" }} />
                </tr>
              </thead>
              <tbody>
                {visible.map(({ a, series, wf }) => {
                  const g = series[3].total - series[0].total;
                  const gp = series[0].total ? g / series[0].total : null;
                  const isOpen = !!open[a.id];
                  return (
                    <React.Fragment key={a.id}>
                      <tr className="rowhover" style={{ borderBottom: `1px solid ${C.lineSoft}`, background: isOpen ? C.pinkSoft : "transparent" }}>
                        <td style={{ padding: "7px 10px", maxWidth: 250 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <button onClick={() => setOpen((o) => ({ ...o, [a.id]: !isOpen }))}
                              title={isOpen ? "Collapse" : "Open numbers"}
                              style={{ border: "none", background: "transparent", cursor: "pointer", color: isOpen ? C.purple : C.muted, fontFamily: BODY, fontSize: 11, fontWeight: isOpen ? 700 : 400, padding: 0, width: 12 }}>
                              {isOpen ? "▾" : "▸"}
                            </button>
                            <input value={a.name} onChange={(e: ChangeEvent<HTMLInputElement>) => patch(a.id, { name: e.target.value })} placeholder="Account name"
                              style={{ border: "none", background: "transparent", fontFamily: BODY, fontSize: 13, color: C.ink, width: "100%", outline: "none", padding: "1px 2px" }} />
                            {hasOverrides(a) && <span title="Has account-specific product pricing" style={{ fontFamily: BODY, fontSize: 11, color: C.aubergine }}>✱</span>}
                            {a.zd && <span title="Has a Zendesk org" style={{ fontFamily: BODY, fontSize: 9.5, fontWeight: 700, color: C.magenta, background: C.pinkSoft, borderRadius: Rsm, padding: "1px 4px" }}>ZD</span>}
                          </div>
                        </td>
                        <td style={{ padding: "5px 10px" }}>
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                            {PRODUCTS.map((p) => (
                              <Chip key={p} state={a.products[p]} label={SHORT[p]} onClick={() => cycle(a.id, p)}
                                title={`${p}: ${a.products[p] || "not tracked"} — click for target / live / n-a`} />
                            ))}
                          </div>
                        </td>
                        <td style={{ ...td, color: C.muted }}>{money(series[0].total)}</td>
                        <td style={td}>{money(series[1].total)}</td>
                        <td style={td}>{money(series[2].total)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{money(series[3].total)}</td>
                        <td style={{ ...td, color: g > 0 ? C.live : g < 0 ? C.red : C.muted }}>
                          {g >= 0 ? "+" : ""}{money(g)}{gp != null && <span style={{ color: C.muted, fontSize: 11 }}> {gp >= 0 ? "+" : ""}{pct(gp)}</span>}
                        </td>
                        <td style={{ ...td, width: 28 }}>
                          <button onClick={() => removeRow(a.id)} title="Remove account"
                            style={{ border: "none", background: "transparent", color: "#BCC4BD", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ padding: 0 }}>
                            <Drawer a={a} s={s} patch={(f) => patch(a.id, f)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {visible.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 28, textAlign: "center", color: C.muted, fontSize: 13 }}>
                    No account matches “{q}”. Clear the filter, or add it as a new row.
                  </td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `1.5px solid ${C.ink}`, background: C.panel }}>
                  <td style={{ padding: "10px", fontFamily: BODY, fontSize: 13.5, fontWeight: 700 }}>
                    Book total
                  </td>
                  <td style={{ padding: "10px", fontFamily: BODY, fontSize: 11.5, color: C.muted }}>
                    {rows.reduce((t, r) => t + PRODUCTS.filter((p) => r.a.products[p] === "LIVE").length, 0)} live ·{" "}
                    {rows.reduce((t, r) => t + PRODUCTS.filter((p) => r.a.products[p] === "TARGET").length, 0)} target
                  </td>
                  {totals.years.map((v, i) => (
                    <td key={i} style={{ ...td, fontWeight: i === 3 ? 700 : 500, fontSize: 13, color: i === 0 ? C.ink2 : C.ink }}>{money(v)}</td>
                  ))}
                  <td style={{ ...td, color: C.live, fontWeight: 600 }}>+{money(totals.years[3] - totals.years[0])}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div style={{ marginTop: U, fontSize: 12.5, color: C.ink, lineHeight: 1.65 }}>
          <strong style={{ color: C.purple, fontWeight: 700 }}>Working this table.</strong> Click the caret to open an account's tabs, or a
          product chip to cycle it between target, live and not applicable. Every field you touch recalculates the book immediately and saves itself.
        </div>
          </>
        )}

        {page === "overview" && (
        <>

        {/* ── KPI band ── */}
        <div style={{ position: "relative", background: C.panel, borderRadius: R, padding: U, marginBottom: U, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.06 }}><SpacePattern fill={C.purple} size={30} /></div>
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))", gap: 16, marginBottom: 18 }}>
            <Kpi label="2025 baseline" value={money(totals.years[0])} note={`booked ${money(BOOKED_2025)}`} />
            <Kpi label="Year 1" value={money(totals.years[1])} note={delta(totals.years[1], totals.years[0])} />
            <Kpi label="Year 2" value={money(totals.years[2])} note={delta(totals.years[2], totals.years[0])} />
            <Kpi label="Year 3" value={money(totals.years[3])} note={delta(totals.years[3], totals.years[0])} big />
            <Kpi label="3-yr growth" value={pct(growthPct)} note={`${pct(cagr, 1)} CAGR`} />
            <Kpi label="New revenue" value={money(totals.years[3] - totals.years[0])} note={s.riskWeight ? `risk-weighted at ${s.winProb}%` : "unweighted"} />
            <Kpi label="Held back by renewal" value={money(totals.atRisk[3])}
              note={s.renewalRisk ? `${rows.filter((r) => r.a.contractEnd && renewalYear(r.a)).length} contracts in horizon` : "renewal risk off"} />
          </div>
          <div style={{ position: "relative" }}>
            <BuildStrip parts={{ base: totals.base, volume: totals.volume, fee: totals.fee, adoption: totals.adoption, newProducts: totals.newProducts }}
              total={totals.base + totals.volume + totals.fee + totals.adoption + totals.newProducts} />
            {(totals.capped[3] > 1 || totals.atRisk[3] > 1) && (
              <div style={{ marginTop: 8, fontFamily: BODY, fontSize: 11.5, color: C.ink, display: "flex", flexWrap: "wrap", gap: 14 }}>
                {totals.capped[3] > 1 && <span>Less contract ceilings <b style={{ color: C.aubergine }}>&minus;{money(totals.capped[3])}</b></span>}
                {totals.atRisk[3] > 1 && <span>Less renewal risk <b style={{ color: C.aubergine }}>&minus;{money(totals.atRisk[3])}</b></span>}
                <span style={{ marginLeft: "auto" }}>Year 3 risk-adjusted <b>{dollars(totals.years[3])}</b></span>
              </div>
            )}
          </div>
          {Math.abs(unpriced) > 1000 && (
            <div style={{ position: "relative", marginTop: 14, fontSize: 12.5, color: C.ink, background: C.pink, borderRadius: R, padding: `${U / 2}px ${U * 0.7}px` }}>
              {unpriced > 0 ? (
                <>Your modeled 2025 baseline runs <strong>{money(unpriced)}</strong> above the {money(BOOKED_2025)} you actually booked. That gap is products sitting at LIVE which carry a price here but no revenue in the spreadsheet — mostly MOR. Either it's bundled into the transaction fee, or it's value you're giving away.</>
              ) : (
                <>Your modeled 2025 baseline runs <strong>{money(-unpriced)}</strong> below the {money(BOOKED_2025)} you booked. Some revenue isn't reaching the model — check accounts where a product is earning but its state is blank or N/A.</>
              )}
            </div>
          )}
        </div>

        {/* ── blended rates ── */}
        <div style={{ background: C.panel, borderRadius: R, padding: U, marginBottom: U }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: U, alignItems: "flex-start" }}>
            <div style={{ minWidth: 210 }}>
              <Label style={{ marginBottom: 2 }}>Blended transaction fee</Label>
              <Info style={{ marginBottom: 8 }}>Weighted by transactions, live MPP accounts only</Info>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, letterSpacing: "-0.02em", color: C.muted }}>{cents3(rates[0].fee)}</span>
                <span style={{ fontFamily: BODY, fontSize: 15, color: C.muted }}>&rarr;</span>
                <span style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", color: C.purple }}>{cents3(rates[3].fee)}</span>
              </div>
              <Info style={{ marginTop: 3 }}>
                {rates[0].fee
                  ? `${rates[3].fee >= rates[0].fee ? "+" : ""}${cents3(rates[3].fee - rates[0].fee)} per transaction, ${pct((rates[3].fee - rates[0].fee) / rates[0].fee)} by Year 3`
                  : "no live MPP volume in the book"}
              </Info>
            </div>

            <div style={{ flex: "1 1 380px", minWidth: 300 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: BODY, fontSize: 12 }}>
                <thead>
                  <tr style={{ color: C.muted }}>
                    <th style={{ textAlign: "left", padding: "3px 0", fontWeight: 400 }} />
                    {["2025", "Y1", "Y2", "Y3"].map((h) => <th key={h} style={{ textAlign: "right", padding: "3px 0", fontWeight: 400 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {([
                    { k: "Avg transaction size", f: (r: Rate) => `$${r.size.toFixed(2)}`, hint: "mix shifts as adoption ramps unevenly" },
                    { k: "Blended fee", f: (r: Rate) => cents3(r.fee), bold: true },
                    { k: "Effective take rate", f: (r: Rate) => pct(r.take, 2), hint: "fee as a share of the ticket" },
                    { k: "MPP transactions", f: (r: Rate) => nInt(r.trx) },
                    { k: "Processed volume", f: (r: Rate) => money(r.size * r.trx) },
                  ] as RateRow[]).map((row) => (
                    <tr key={row.k} style={{ borderTop: `1px solid ${C.lineSoft}` }}>
                      <td style={{ padding: "5px 0", color: C.ink, fontWeight: row.bold ? 700 : 400 }}>
                        {row.k}
                        {row.hint && <Info style={{ fontSize: 10 }}>{row.hint}</Info>}
                      </td>
                      {rates.map((r, i) => (
                        <td key={i} style={{ textAlign: "right", padding: "5px 0", color: i === 0 ? C.muted : C.ink, fontWeight: row.bold ? 700 : 400 }}>
                          {row.f(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totals.feeGross > 1 && (
            <div style={{ marginTop: U * 0.7, fontSize: 12.5, color: C.ink, background: C.pink, borderRadius: R, padding: `${U / 2}px ${U * 0.7}px` }}>
              {s.elasticityOn ? (
                <>Fee increases are worth <b>{money(totals.feeGross)}</b> gross at Year 3, <b>{money(totals.feeGross - totals.elasticityCost)}</b> net after roughly {nInt(totals.trxLost)} sessions shift back to hardware. The take rate goes from {pct(rates[0].take, 2)} to {pct(rates[3].take, 2)} of the ticket.</>
              ) : (
                <>Fee increases are worth <b>{money(totals.feeGross)}</b> at Year 3 with no adoption response modeled, and the take rate climbs from {pct(rates[0].take, 2)} to {pct(rates[3].take, 2)} of the ticket. Turn on <b>Fee costs adoption</b> to price the channel shift.</>
              )}
            </div>
          )}
        </div>

        {/* ── biggest levers ── */}
        <Panel title="Where the next dollar is" open={showLevers} toggle={() => setShowLevers((v) => !v)}
          subtitle="Ranked by annual value at Year 3">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(268px,1fr))", gap: 8 }}>
            {levers.map((l, i) => (
              <button key={i} onClick={() => setOpen((o) => ({ ...o, [l.id]: true }))}
                style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer",
                  background: C.panel, borderLeft: `5px solid ${l.kind === "Fee increase" ? C.purple : l.kind === "Adoption lift" ? C.lightPurple : C.pink}`,
                  borderRadius: R, padding: `${U / 2}px ${U * 0.6}px`,
                }}>
                <span style={{ fontFamily: BODY, fontSize: 11.5, color: C.muted, width: 16 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                  <span style={{ fontFamily: BODY, fontSize: 11.5, color: C.muted }}>{l.kind}</span>
                </span>
                <span style={{ fontFamily: BODY, fontSize: 13.5, color: C.ink, fontWeight: 700 }}>{money(l.value)}</span>
              </button>
            ))}
          </div>
        </Panel>

        <div style={{ marginTop: U, fontSize: 12.5, color: C.ink, lineHeight: 1.65 }}>
          <strong style={{ color: C.purple, fontWeight: 700 }}>How the math runs.</strong> MPP revenue is addressable transactions ×
          MPP adoption × fee, so lifting adoption and lifting the fee compound — and the fee increase then gives some of that adoption back
          when elasticity is on. Volume grows at each account's own rate, adoption ramps linearly to its Year-3 target, and the fee steps up
          in whichever year you set. Target products contribute from their go-live year scaled by win probability, contract ceilings cap what
          can be billed, and renewal risk weights everything after a contract ends.
        </div>

        </>
        )}

          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────  bits  ───────────────────────────── */
function Kpi({ label, value, note, big }: { label: string; value: string; note?: ReactNode; big?: boolean }) {
  return (
    <div>
      <Label style={{ fontSize: 11.5, color: C.ink }}>{label}</Label>
      <div style={{ fontFamily: DISPLAY, fontSize: big ? 36 : 28, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.05, marginTop: 4, color: big ? C.purple : C.ink }}>{value}</div>
      {note && <Info style={{ fontSize: 11, marginTop: 3 }}>{note}</Info>}
    </div>
  );
}

function delta(v: number, base: number): string {
  if (!base) return "";
  const d = (v - base) / base;
  return `${d >= 0 ? "+" : ""}${pct(d)} vs 2025`;
}

function Panel({ title, subtitle, open, toggle, children }: {
  title: string; subtitle?: string; open: boolean; toggle: () => void; children: ReactNode;
}) {
  return (
    <div style={{ background: C.panel, borderRadius: R, marginBottom: U }}>
      <button onClick={toggle} style={{
        width: "100%", display: "flex", alignItems: "baseline", gap: 10, cursor: "pointer",
        background: "transparent", border: "none", padding: `${U * 0.6}px ${U}px`, textAlign: "left",
      }}>
        <span style={{ fontFamily: BODY, fontSize: 11, color: C.purple }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontFamily: BODY, fontSize: 14.5, fontWeight: 700, color: C.purple }}>{title}</span>
        {subtitle && <span style={{ fontSize: 12.5, color: C.muted }}>{subtitle}</span>}
      </button>
      {open && <div style={{ padding: `0 ${U}px ${U}px` }}>{children}</div>}
    </div>
  );
}

const btn = (primary?: boolean): CSSProperties => ({
  fontFamily: BODY, fontSize: 12.5, fontWeight: primary ? 700 : 500,
  padding: "8px 14px", borderRadius: R, cursor: "pointer",
  background: primary ? C.purple : C.panel, color: primary ? "#fff" : C.ink,
  border: `1px solid ${primary ? C.purple : C.line}`,
});

const pill = (on: boolean): CSSProperties => ({
  fontFamily: BODY, fontSize: 12, fontWeight: on ? 700 : 400, padding: "5px 10px",
  borderRadius: Rsm, cursor: "pointer",
  background: on ? C.pink : "transparent", color: on ? C.aubergine : C.ink,
  border: `1px solid ${on ? C.pink : C.line}`,
});
