/* One product across the whole book: who has it, who could, and what each
   account pays. Rates edit in place. */

import { BODY, C, DISPLAY, R, U } from "../tokens";
import { dollars, money, pct } from "../format";
import { MODEL_LABEL, PLAN_YEARS, PRODUCTS, potential, resolveEcon } from "../model";
import { linkBtn, tdCell, thCell } from "../styles";
import { Chip, Info, Kpi, Num, SpacePattern } from "../ui";
import type { AccountRow, Patch, ProductId, ProductState, SetOpen, Settings } from "../types";

/* Product picker lives inside the Products page, so the header stays stable
   when the portfolio grows. */
export function ProductPicker({ value, setValue, counts, revenue }: {
  value: ProductId; setValue: (p: ProductId) => void;
  counts: Record<ProductId, number>; revenue: Record<ProductId, number>;
}) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: U }}>
      {PRODUCTS.map((p) => {
        const on = value === p;
        return (
          <button key={p} onClick={() => setValue(p)} aria-pressed={on}
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

export function ProductPage({ p, rows, s, patch, cycle, setOpen, showAll }: {
  p: ProductId; rows: AccountRow[]; s: Settings; patch: Patch;
  cycle: (id: string, p: ProductId) => void; setOpen: SetOpen; showAll: boolean;
}) {
  const e0 = s.econ[p];
  const isMpp = p === "MPP";
  const isFb = p === "Flowbird";

  const enriched = rows.map((r) => ({
    ...r,
    state: (r.a.products[p] || "") as ProductState,
    rev: PLAN_YEARS.map((i) => r.series[i]?.byProduct[p] ?? 0),
    up: potential(r.a, s, p),
  }));
  const adopters = enriched.filter((r) => r.state === "LIVE" || r.state === "TARGET").sort((x, y) => (y.rev[3] ?? 0) - (x.rev[3] ?? 0));
  const others = enriched.filter((r) => !(r.state === "LIVE" || r.state === "TARGET")).sort((x, y) => y.up - x.up);
  const listed = showAll ? [...adopters, ...others] : adopters;

  const live = enriched.filter((r) => r.state === "LIVE").length;
  const target = enriched.filter((r) => r.state === "TARGET").length;
  const na = enriched.filter((r) => r.state === "N/A").length;
  const untracked = enriched.length - live - target - na;
  const rev = PLAN_YEARS.map((i) => enriched.reduce((t, r) => t + (r.rev[i] ?? 0), 0));
  const upside = others.reduce((t, r) => t + r.up, 0);
  const bookY3 = enriched.reduce((t, r) => t + (r.series[3]?.total ?? 0), 0);
  const rev3 = rev[3] ?? 0;

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
            <Kpi label="Year 3 revenue" value={money(rev3)} note={`${pct(bookY3 ? rev3 / bookY3 : 0)} of book Y3`} big />
            <Kpi label="Untapped at Y3" value={money(upside)} note="unweighted, if adopted in Y1" />
          </div>

          <div style={{ display: "flex", height: 22, borderRadius: R, overflow: "hidden", gap: 3 }}>
            {[
              { k: "live", n: live, fill: C.purple },
              { k: "target", n: target, fill: C.pink },
              { k: "na", n: na, fill: C.na },
              { k: "untracked", n: untracked, fill: C.line },
            ].filter((x) => x.n > 0).map((x) => (
              <div key={x.k} title={`${x.n} accounts`} style={{ flex: `${x.n} 1 0`, background: x.fill, borderRadius: R }} />
            ))}
          </div>
          <Info style={{ marginTop: 7 }}>
            Adoption across {enriched.length} accounts. Revenue moves from {money(rev[0] ?? 0)} in 2025 to {money(rev3)} at Year 3.
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
                <th style={{ ...thCell, textAlign: "left" }}>Account</th>
                <th style={{ ...thCell, textAlign: "left" }}>State</th>
                <th style={{ ...thCell, textAlign: "left" }}>{isMpp ? "Fee now / target" : isFb ? "Stations / rate" : "Rate"}</th>
                <th style={thCell}>2025</th>
                <th style={thCell}>Y1</th>
                <th style={thCell}>Y2</th>
                <th style={thCell}>Y3</th>
                <th style={thCell}>If adopted</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((r) => {
                const a = r.a;
                const has = r.state === "LIVE" || r.state === "TARGET";
                const e = resolveEcon(a, s, p);
                const setRate = (v: number) => patch(a.id, { econ: { ...a.econ, [p]: v } });
                const fid = (part: string) => `prod-${p}-${a.id}-${part}`;
                return (
                  <tr key={a.id} className="rowhover"
                    style={{ borderBottom: `1px solid ${C.lineSoft}`, opacity: has ? 1 : 0.48 }}>
                    <td style={{ padding: "7px 10px", maxWidth: 240 }}>
                      <button onClick={() => setOpen((o) => ({ ...o, [a.id]: true }))} style={linkBtn()}>
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
                          <Num id={fid("feeNow")} ariaLabel={`${a.name} fee now`} value={a.feeNow} onChange={(v) => patch(a.id, { feeNow: v })} step={0.01} prefix="$" w={82} />
                          <span style={{ color: C.muted, fontSize: 11 }}>&rarr;</span>
                          <Num id={fid("feeTarget")} ariaLabel={`${a.name} fee after increase`} value={a.feeTarget} onChange={(v) => patch(a.id, { feeTarget: v })} step={0.01} prefix="$" w={82} />
                        </div>
                      ) : isFb ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Num id={fid("fbStations")} ariaLabel={`${a.name} stations`} value={a.fbStations} onChange={(v) => patch(a.id, { fbStations: v })} step={1} w={62} />
                          <Num id={fid("fbRate")} ariaLabel={`${a.name} per station rate`} value={a.fbRate} onChange={(v) => patch(a.id, { fbRate: v })} step={10} prefix="$" w={86} />
                        </div>
                      ) : (
                        <Num id={fid("rate")} ariaLabel={`${a.name} ${p} rate`} value={e.rate} onChange={setRate}
                          step={e.model === "bps" ? 1 : e.model === "flat" ? 100 : e.model === "pctMpp" ? 0.5 : 0.01}
                          prefix={e.model === "flat" || e.model === "perTrx" || e.model === "perStation" ? "$" : ""}
                          suffix={e.model === "bps" ? "bps" : e.model === "pctMpp" ? "%" : ""} w={112} />
                      )}
                    </td>
                    {r.rev.map((v, i) => (
                      <td key={i} style={{ ...tdCell, color: i === 0 ? C.muted : C.ink, fontWeight: i === 3 && has ? 700 : 400 }}>
                        {v > 0 ? money(v) : "—"}
                      </td>
                    ))}
                    <td style={{ ...tdCell, color: C.aubergine, fontWeight: r.up > 0 ? 700 : 400 }}>
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
                  <td key={i} style={{ ...tdCell, fontWeight: i === 3 ? 700 : 500, fontSize: 13 }}>{money(v)}</td>
                ))}
                <td style={{ ...tdCell, color: C.aubergine, fontWeight: 700 }}>{money(upside)}</td>
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
