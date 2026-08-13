/* The book-level story: headline figures, how the Year 3 number is built, the
   blended transaction fee, and where the next dollar is. */

import { BODY, C, DISPLAY, R, U } from "../tokens";
import { cents3, delta, dollars, money, nInt, pct } from "../format";
import { BOOKED_2025 } from "../seed";
import { renewalYear } from "../model";
import { BuildStrip, Info, Kpi, Label, Panel, SpacePattern } from "../ui";
import type { AccountRow, Lever, Rate, RateRow, SetOpen, Settings, Totals } from "../types";

const RATE_ROWS: RateRow[] = [
  { k: "Avg transaction size", f: (r: Rate) => `$${r.size.toFixed(2)}`, hint: "mix shifts as adoption ramps unevenly" },
  { k: "Blended fee", f: (r: Rate) => cents3(r.fee), bold: true },
  { k: "Effective take rate", f: (r: Rate) => pct(r.take, 2), hint: "fee as a share of the ticket" },
  { k: "MPP transactions", f: (r: Rate) => nInt(r.trx) },
  { k: "Processed volume", f: (r: Rate) => money(r.size * r.trx) },
];

export function OverviewPage({
  totals, rows, rates, s, levers, setOpen, showLevers, setShowLevers,
}: {
  totals: Totals; rows: AccountRow[]; rates: Rate[]; s: Settings; levers: Lever[];
  setOpen: SetOpen; showLevers: boolean; setShowLevers: (v: boolean) => void;
}) {
  const y0 = totals.years[0] ?? 0;
  const y3 = totals.years[3] ?? 0;
  const growthPct = y0 ? (y3 - y0) / y0 : 0;
  const cagr = y0 > 0 ? Math.pow(y3 / y0, 1 / 3) - 1 : 0;
  const unpriced = y0 - BOOKED_2025;
  const atRisk3 = totals.atRisk[3] ?? 0;
  const capped3 = totals.capped[3] ?? 0;
  const r0 = rates[0];
  const r3 = rates[3];

  return (
    <>
      {/* ── KPI band ── */}
      <div style={{ position: "relative", background: C.panel, borderRadius: R, padding: U, marginBottom: U, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.06 }}><SpacePattern fill={C.purple} size={30} /></div>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))", gap: 16, marginBottom: 18 }}>
          <Kpi label="2025 baseline" value={money(y0)} note={`booked ${money(BOOKED_2025)}`} />
          <Kpi label="Year 1" value={money(totals.years[1] ?? 0)} note={delta(totals.years[1] ?? 0, y0)} />
          <Kpi label="Year 2" value={money(totals.years[2] ?? 0)} note={delta(totals.years[2] ?? 0, y0)} />
          <Kpi label="Year 3" value={money(y3)} note={delta(y3, y0)} big />
          <Kpi label="3-yr growth" value={pct(growthPct)} note={`${pct(cagr, 1)} CAGR`} />
          <Kpi label="New revenue" value={money(y3 - y0)} note={s.riskWeight ? `risk-weighted at ${s.winProb}%` : "unweighted"} />
          <Kpi label="Held back by renewal" value={money(atRisk3)}
            note={s.renewalRisk ? `${rows.filter((r) => r.a.contractEnd && renewalYear(r.a)).length} contracts in horizon` : "renewal risk off"} />
        </div>
        <div style={{ position: "relative" }}>
          <BuildStrip
            parts={{ base: totals.base, volume: totals.volume, fee: totals.fee, adoption: totals.adoption, newProducts: totals.newProducts }}
            total={totals.base + totals.volume + totals.fee + totals.adoption + totals.newProducts} />
          {(capped3 > 1 || atRisk3 > 1) && (
            <div style={{ marginTop: 8, fontFamily: BODY, fontSize: 11.5, color: C.ink, display: "flex", flexWrap: "wrap", gap: 14 }}>
              {capped3 > 1 && <span>Less contract ceilings <b style={{ color: C.aubergine }}>&minus;{money(capped3)}</b></span>}
              {atRisk3 > 1 && <span>Less renewal risk <b style={{ color: C.aubergine }}>&minus;{money(atRisk3)}</b></span>}
              <span style={{ marginLeft: "auto" }}>Year 3 risk-adjusted <b>{dollars(y3)}</b></span>
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
              <span style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, letterSpacing: "-0.02em", color: C.muted }}>{cents3(r0?.fee ?? 0)}</span>
              <span style={{ fontFamily: BODY, fontSize: 15, color: C.muted }}>&rarr;</span>
              <span style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", color: C.purple }}>{cents3(r3?.fee ?? 0)}</span>
            </div>
            <Info style={{ marginTop: 3 }}>
              {r0?.fee
                ? `${(r3?.fee ?? 0) >= r0.fee ? "+" : ""}${cents3((r3?.fee ?? 0) - r0.fee)} per transaction, ${pct(((r3?.fee ?? 0) - r0.fee) / r0.fee)} by Year 3`
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
                {RATE_ROWS.map((row) => (
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
              <>Fee increases are worth <b>{money(totals.feeGross)}</b> gross at Year 3, <b>{money(totals.feeGross - totals.elasticityCost)}</b> net after roughly {nInt(totals.trxLost)} sessions shift back to hardware. The take rate goes from {pct(r0?.take ?? 0, 2)} to {pct(r3?.take ?? 0, 2)} of the ticket.</>
            ) : (
              <>Fee increases are worth <b>{money(totals.feeGross)}</b> at Year 3 with no adoption response modeled, and the take rate climbs from {pct(r0?.take ?? 0, 2)} to {pct(r3?.take ?? 0, 2)} of the ticket. Turn on <b>Fee costs adoption</b> to price the channel shift.</>
            )}
          </div>
        )}
      </div>

      {/* ── biggest levers ── */}
      <Panel title="Where the next dollar is" open={showLevers} toggle={() => setShowLevers(!showLevers)}
        subtitle="Ranked by annual value at Year 3">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(268px,1fr))", gap: 8 }}>
          {levers.map((l, i) => (
            <button key={`${l.id}-${l.kind}`} onClick={() => setOpen((o) => ({ ...o, [l.id]: true }))}
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
  );
}
