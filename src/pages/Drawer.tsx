/* The expanding panel under an account row: its own numbers, contract terms,
   and one tab per product. Every input id is scoped by account id, so two open
   drawers never collide. */

import { useState } from "react";
import type { ChangeEvent } from "react";

import { BODY, C, Rsm, U } from "../tokens";
import { cents, dollars, money, nInt, pct } from "../format";
import {
  MODEL_LABEL, PERCENT, PRODUCTS, RAMP_YEARS, SHORT,
  accountSeries, clamp, renewalYear, resolveEcon, waterfall,
} from "../model";
import { quietAction, selectStyle } from "../styles";
import { BuildStrip, Field, Info, Label, Num, TabBar, Text } from "../ui";
import type { Account, EconModelId, ProductId, Settings, YearResult } from "../types";

/* Which inputs belong on which product tab, beyond the shared pricing block. */
const PRODUCT_NOTE: Record<ProductId, string> = {
  MPP: "Priced from this account's own transaction fee, so the rate fields below are the fee itself.",
  MOR: "Earns on processed dollars, so the average transaction size on the Overview tab drives it.",
  Reservations: "Earns per MPP session. Blend your attach rate into the per-transaction figure.",
  Flowbird: "Earns per station per year. The per-station rate here is already account-specific.",
  Insights: "A flat annual licence. Set the figure this account actually pays.",
  GMP: "Earns as a percentage of this account's MPP revenue, so it moves with adoption and fee.",
};

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

  /* Unique per account and per product, so the MPP tab and the MOR tab of the
     same account do not share field ids. */
  const fid = (part: string) => `acct-${a.id}-${p}-${part}`;
  const rateLabel = e.model === "flat" ? "Annual cost for this account"
    : e.model === "bps" ? "Basis points"
      : e.model === "pctMpp" ? "Percent of MPP revenue"
        : e.model === "perStation" ? "Per station, per year"
          : "Per MPP transaction";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: U * 0.7 }}>
        <Field label="How it earns" htmlFor={fid("model")}
          hint={e.modelOverridden ? `book default is ${MODEL_LABEL[e.bookModel]}` : "following the book default"}>
          <select id={fid("model")} name={fid("model")} value={a.econModel[p] || ""}
            onChange={(ev: ChangeEvent<HTMLSelectElement>) => setModel(ev.target.value)}
            style={selectStyle()}>
            <option value="">Book default — {MODEL_LABEL[e.bookModel]}</option>
            {(Object.keys(MODEL_LABEL) as EconModelId[]).map((m) => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}
          </select>
        </Field>

        {isMpp ? (
          <>
            <Field label="Fee now" hint="this account's own rate" htmlFor={fid("feeNow")}>
              <Num id={fid("feeNow")} value={a.feeNow} onChange={(v) => patch({ feeNow: v })} step={0.01} prefix="$" w="100%" />
            </Field>
            <Field label="Fee after increase" htmlFor={fid("feeTarget")}
              hint={s.feeBump ? `+ ${cents(s.feeBump)} book-wide applies` : `+${cents(a.feeTarget - a.feeNow)} vs today`}>
              <Num id={fid("feeTarget")} value={a.feeTarget} onChange={(v) => patch({ feeTarget: v })} step={0.01} prefix="$" w="100%" />
            </Field>
            <Field label="Increase lands in year" htmlFor={fid("feeYear")}>
              <Num id={fid("feeYear")} value={a.feeYear} onChange={(v) => patch({ feeYear: clamp(Math.round(v), 1, RAMP_YEARS) })}
                step={1} min={1} max={RAMP_YEARS} w="100%" />
            </Field>
          </>
        ) : p === "Flowbird" ? null : (
          <Field label={rateLabel} htmlFor={fid("rate")}
            hint={e.rateOverridden ? `overriding the book default of ${e.model === "bps" ? e.bookRate + " bps" : e.model === "pctMpp" ? e.bookRate + "%" : dollars(e.bookRate)}` : "book default — type here to override"}>
            <Num id={fid("rate")} value={e.rate} onChange={setRate} step={step}
              prefix={e.model === "flat" || e.model === "perTrx" || e.model === "perStation" ? "$" : ""}
              suffix={e.model === "bps" ? "bps" : e.model === "pctMpp" ? "%" : ""} w="100%" />
          </Field>
        )}

        {p === "Flowbird" && (
          <>
            <Field label="Stations" htmlFor={fid("fbStations")}>
              <Num id={fid("fbStations")} value={a.fbStations} onChange={(v) => patch({ fbStations: v })} step={1} w="100%" />
            </Field>
            <Field label="Per station, per year" htmlFor={fid("fbRate")}
              hint={a.fbStations ? `${dollars(a.fbStations * a.fbRate)} hardware ARR` : "no stations yet"}>
              <Num id={fid("fbRate")} value={a.fbRate} onChange={(v) => patch({ fbRate: v })} step={10} prefix="$" w="100%" />
            </Field>
          </>
        )}

        <Field label="State" htmlFor={fid("state")}
          hint={a.products[p] === "TARGET" ? "counts from its go-live year" : a.products[p] === "LIVE" ? "counts in every year" : "contributes nothing"}>
          <select id={fid("state")} name={fid("state")} value={a.products[p] || ""}
            onChange={(ev: ChangeEvent<HTMLSelectElement>) => patch({ products: { ...a.products, [p]: ev.target.value } })}
            style={selectStyle()}>
            <option value="">Not tracked</option>
            <option value="TARGET">Target</option>
            <option value="LIVE">Live</option>
            <option value="N/A">N/A</option>
          </select>
        </Field>

        {a.products[p] === "TARGET" && (
          <>
            <Field label="Go live in year" htmlFor={fid("goLive")}>
              <Num id={fid("goLive")} value={a.goLive[p] || s.defaultGoLive}
                onChange={(v) => patch({ goLive: { ...a.goLive, [p]: clamp(Math.round(v), 1, RAMP_YEARS) } })}
                step={1} min={1} max={RAMP_YEARS} w="100%" />
            </Field>
            <Field label="Win probability" htmlFor={fid("winProb")}
              hint={s.riskWeight ? "scales the revenue below" : "risk weighting is off"}>
              <Num id={fid("winProb")} value={a.winProb == null ? s.winProb : a.winProb}
                onChange={(v) => patch({ winProb: clamp(v, 0, PERCENT) })} step={5} suffix="%" w="100%" />
            </Field>
          </>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: C.panel, border: `1px solid ${C.tintDeep}`, borderRadius: Rsm, padding: `${U * 0.4}px ${U * 0.6}px` }}>
        <span style={{ fontFamily: BODY, fontSize: 11.5, color: C.muted }}>Contribution</span>
        {["2025", "Y1", "Y2", "Y3"].map((lab, i) => (
          <span key={lab} style={{ fontFamily: BODY, fontSize: 12 }}>
            <span style={{ color: C.muted }}>{lab} </span>
            <b style={{ color: (series[i]?.byProduct[p] ?? 0) > 0 ? C.ink : C.muted }}>{money(series[i]?.byProduct[p] ?? 0)}</b>
          </span>
        ))}
        {(e.rateOverridden || e.modelOverridden) && (
          <button onClick={() => { clearRate(); setModel(""); }} style={{ ...quietAction, marginLeft: "auto" }}>
            Revert to book default
          </button>
        )}
      </div>

      <Info style={{ marginTop: U * 0.5 }}>{PRODUCT_NOTE[p]}</Info>
    </div>
  );
}

export function Drawer({ a, s, patch }: {
  a: Account; s: Settings; patch: (fields: Partial<Account>) => void;
}) {
  const [tab, setTab] = useState<string>("overview");
  const series = accountSeries(a, s);
  const wf = waterfall(a, s);
  const set = (k: keyof Account) => (v: number) => patch({ [k]: v } as Partial<Account>);
  const ry = renewalYear(a);
  const y3 = series[3];

  const fid = (part: string) => `acct-${a.id}-${part}`;

  const stateColor = (p: ProductId): string => (
    a.products[p] === "LIVE" ? C.purple
      : a.products[p] === "TARGET" ? C.magenta
        : a.products[p] === "N/A" ? C.na : C.line
  );
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
            <Field label="Addressable transactions" htmlFor={fid("addressable")} hint={`${nInt(a.addressable * a.adoptionNow)} on MPP today`}>
              <Num id={fid("addressable")} value={a.addressable} onChange={set("addressable")} step={1000} w="100%" />
            </Field>
            <Field label="MPP adoption now" htmlFor={fid("adoptionNow")} hint={`meter/HW share ${pct(1 - a.adoptionNow)}`}>
              <Num id={fid("adoptionNow")} value={a.adoptionNow} onChange={(v) => patch({ adoptionNow: clamp(v, 0, 1) })} step={0.01} min={0} max={1} w="100%" />
            </Field>
            <Field label="MPP adoption target (Y3)" htmlFor={fid("adoptionTarget")}
              hint={s.adoptionDelta ? `scenario ${s.adoptionDelta > 0 ? "+" : ""}${pct(s.adoptionDelta)}` : `linear ramp over ${RAMP_YEARS} yrs`}>
              <Num id={fid("adoptionTarget")} value={a.adoptionTarget} onChange={(v) => patch({ adoptionTarget: clamp(v, 0, 1) })} step={0.01} min={0} max={1} w="100%" />
            </Field>
            <Field label="Avg transaction $" htmlFor={fid("avgTrx")} hint="drives MOR basis points">
              <Num id={fid("avgTrx")} value={a.avgTrx} onChange={set("avgTrx")} step={0.1} prefix="$" w="100%" />
            </Field>
            <Field label="Transaction growth / yr" htmlFor={fid("growth")}
              hint={s.growthDelta ? `scenario ${pct(a.growth + s.growthDelta, 1)} effective` : "from your trx history"}>
              <Num id={fid("growth")} value={a.growth} onChange={set("growth")} step={0.01} w="100%" />
            </Field>
            <Field label="Fee elasticity override" htmlFor={fid("elasticity")}
              hint={a.elasticity == null ? `book default ${s.feeElasticity.toFixed(2)}` : "0 makes this account insensitive"}>
              <Num id={fid("elasticity")} value={a.elasticity == null ? s.feeElasticity : a.elasticity}
                onChange={(v) => patch({ elasticity: clamp(v, -1, 0) })} step={0.05} w="100%" />
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
                          {(typeof a.econ[p] === "number" || !!a.econModel[p]) && (
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
                <Label htmlFor={fid("note")} style={{ fontSize: 11, color: C.ink, marginBottom: 4 }}>Account note</Label>
                <textarea id={fid("note")} name={fid("note")} value={a.note}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => patch({ note: e.target.value })}
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
              ? `Contract ends in ${a.contractEnd}; renewal risk applies from Year ${ry}, holding back ${money(y3?.atRisk ?? 0)} at Year 3.`
              : a.contractEnd
                ? "Ends beyond the three-year horizon, so no renewal risk is modeled."
                : "No end date yet — this account carries no renewal risk until you add one."}
          </Info>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
            <Field label="Contract end" hint="YYYY-MM-DD, or just the year" htmlFor={fid("contractEnd")}>
              <Text id={fid("contractEnd")} value={a.contractEnd} onChange={(v) => patch({ contractEnd: v })} placeholder="2027-06-30" />
            </Field>
            <Field label="Renewal probability" htmlFor={fid("renewProb")} hint={ry ? `applies from Year ${ry}` : "no renewal in horizon"}>
              <Num id={fid("renewProb")} value={a.renewProb == null ? s.defaultRenewProb : a.renewProb}
                onChange={(v) => patch({ renewProb: clamp(v, 0, PERCENT) })} step={5} suffix="%" w="100%" />
            </Field>
            <Field label="Annual not-to-exceed" htmlFor={fid("nteCap")}
              hint={a.nteCap ? ((y3?.capped ?? 0) > 0 ? `Y3 exceeds it by ${money(y3?.capped ?? 0)}` : "Y3 fits under the ceiling") : "0 for no ceiling"}>
              <Num id={fid("nteCap")} value={a.nteCap} onChange={(v) => patch({ nteCap: Math.max(0, v) })} step={10000} prefix="$" w="100%" />
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
