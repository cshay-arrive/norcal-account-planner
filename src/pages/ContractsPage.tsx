/* Contract terms and renewal exposure across the book. */

import { BODY, C, DISPLAY, R, U } from "../tokens";
import { dollars, money } from "../format";
import { BASE_YEAR, HORIZON_YEARS, PERCENT, clamp, renewalYear } from "../model";
import { linkBtn, tdCell, thCell } from "../styles";
import { Info, Kpi, Label, Num, SpacePattern, Text } from "../ui";
import type { AccountRow, Patch, RenewalBucket, SetOpen, Settings } from "../types";

export function ContractsPage({ rows, s, patch, setOpen, onlyMissing }: {
  rows: AccountRow[]; s: Settings; patch: Patch; setOpen: SetOpen; onlyMissing: boolean;
}) {
  const enriched = rows.map((r) => {
    const end = r.a.contractEnd;
    const yr = end ? parseInt(String(end).slice(0, 4), 10) : null;
    return {
      ...r,
      end,
      yr: yr && yr > 2000 ? yr : null,
      ry: renewalYear(r.a),
      y3: r.series[3]?.total ?? 0,
      risk: r.series[3]?.atRisk ?? 0,
      cap: r.series[3]?.capped ?? 0,
    };
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
  const lastNamedYear = BASE_YEAR + HORIZON_YEARS;
  const years = Array.from({ length: HORIZON_YEARS + 1 }, (_, i) => BASE_YEAR + i);
  const buckets: RenewalBucket[] = years.map((y) => ({
    y,
    n: withDate.filter((r) => r.yr === y).length,
    rev: withDate.filter((r) => r.yr === y).reduce((t, r) => t + r.y3, 0),
  }));
  buckets.push({
    y: "Later",
    n: withDate.filter((r) => (r.yr ?? 0) > lastNamedYear).length,
    rev: withDate.filter((r) => (r.yr ?? 0) > lastNamedYear).reduce((t, r) => t + r.y3, 0),
  });
  buckets.push({ y: "Unknown", n: missing.length, rev: unknownRevenue, warn: true });
  const maxRev = Math.max(...buckets.map((b) => b.rev), 1);

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
                <th style={{ ...thCell, textAlign: "left" }}>Account</th>
                <th style={{ ...thCell, textAlign: "left" }}>Contract end</th>
                <th style={{ ...thCell, textAlign: "left" }}>Risk from</th>
                <th style={{ ...thCell, textAlign: "left" }}>Renewal odds</th>
                <th style={{ ...thCell, textAlign: "left" }}>Annual ceiling</th>
                <th style={thCell}>Y3 revenue</th>
                <th style={thCell}>Held back</th>
                <th style={thCell}>Over ceiling</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((r) => {
                const a = r.a;
                const fid = (part: string) => `contract-${a.id}-${part}`;
                return (
                  <tr key={a.id} className="rowhover" style={{ borderBottom: `1px solid ${C.lineSoft}`, opacity: r.ry ? 1 : 0.62 }}>
                    <td style={{ padding: "7px 10px", maxWidth: 230 }}>
                      <button onClick={() => setOpen((o) => ({ ...o, [a.id]: true }))} style={linkBtn()}>
                        {a.name}
                      </button>
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <Text id={fid("end")} ariaLabel={`${a.name} contract end date`} value={a.contractEnd}
                        onChange={(v) => patch(a.id, { contractEnd: v })} placeholder="2027-06-30" w={124} />
                    </td>
                    <td style={{ padding: "5px 10px", fontFamily: BODY, fontSize: 12, color: r.ry ? C.aubergine : C.muted }}>
                      {r.ry ? `Year ${r.ry}` : r.yr ? "Beyond Y3" : "Not set"}
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <Num id={fid("renewProb")} ariaLabel={`${a.name} renewal probability`}
                        value={a.renewProb == null ? s.defaultRenewProb : a.renewProb}
                        onChange={(v) => patch(a.id, { renewProb: clamp(v, 0, PERCENT) })} step={5} suffix="%" w={82} />
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <Num id={fid("nteCap")} ariaLabel={`${a.name} annual not-to-exceed`} value={a.nteCap}
                        onChange={(v) => patch(a.id, { nteCap: Math.max(0, v) })} step={10000} prefix="$" w={112} />
                    </td>
                    <td style={tdCell}>{money(r.y3)}</td>
                    <td style={{ ...tdCell, color: r.risk > 0 ? C.aubergine : C.muted, fontWeight: r.risk > 0 ? 700 : 400 }}>{r.risk > 0 ? money(r.risk) : "—"}</td>
                    <td style={{ ...tdCell, color: r.cap > 0 ? C.aubergine : C.muted }}>{r.cap > 0 ? money(r.cap) : "—"}</td>
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
                <td style={{ ...tdCell, fontWeight: 500, fontSize: 13 }}>{money(enriched.reduce((t, r) => t + r.y3, 0))}</td>
                <td style={{ ...tdCell, color: C.aubergine, fontWeight: 700 }}>{money(totalRisk)}</td>
                <td style={{ ...tdCell, color: C.aubergine, fontWeight: 700 }}>{totalCap > 0 ? money(totalCap) : "—"}</td>
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
