/* The account table: one row per account, expanding into a drawer. */

import { Fragment } from "react";
import type { ChangeEvent } from "react";

import { BODY, C, R, Rsm, U } from "../tokens";
import { money, pct } from "../format";
import { PRODUCTS, SHORT, hasOverrides } from "../model";
import { tdCell, thCell } from "../styles";
import { Chip } from "../ui";
import { Drawer } from "./Drawer";
import type {
  AccountRow, FlagFilter, OpenMap, Patch, ProductId, ProductState,
  SetOpen, Settings, SortKey, Totals,
} from "../types";

const FLAG_LABEL: Record<Exclude<FlagFilter, "all">, string> = {
  overrides: "priced separately",
  nocontract: "no contract date",
  atrisk: "renewal risk",
};

export function AccountsPage({
  visible, rows, accountCount, s, patch, cycle, open, setOpen, removeRow,
  totals, setSortKey, query, filterProduct, filterState, flagFilter,
}: {
  visible: AccountRow[]; rows: AccountRow[]; accountCount: number; s: Settings;
  patch: Patch; cycle: (id: string, p: ProductId) => void;
  open: OpenMap; setOpen: SetOpen; removeRow: (id: string) => void;
  totals: Totals; setSortKey: (k: SortKey) => void;
  query: string; filterProduct: ProductId | ""; filterState: ProductState; flagFilter: FlagFilter;
}) {
  const filtered = !!query || !!filterProduct || flagFilter !== "all";
  const liveCount = rows.reduce((t, r) => t + PRODUCTS.filter((p) => r.a.products[p] === "LIVE").length, 0);
  const targetCount = rows.reduce((t, r) => t + PRODUCTS.filter((p) => r.a.products[p] === "TARGET").length, 0);

  return (
    <>
      <div style={{ background: C.panel, borderRadius: R, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: `${U / 2}px ${U * 0.6}px`, borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
          <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.purple }}>
            {visible.length === accountCount ? "All accounts" : `${visible.length} of ${accountCount} accounts`}
          </span>
          {filtered && (
            <span style={{ fontFamily: BODY, fontSize: 11.5, color: C.muted }}>
              filtered{filterProduct ? ` · ${filterProduct} ${filterState || "not tracked"}` : ""}
              {flagFilter !== "all" ? ` · ${FLAG_LABEL[flagFilter]}` : ""}
            </span>
          )}
          <div style={{ display: "flex", gap: 12, marginLeft: "auto", fontFamily: BODY, fontSize: 11.5, color: C.ink }}>
            <span><b style={{ color: C.purple }}>●</b> Live</span>
            <span><b style={{ color: C.magenta }}>○</b> Target</span>
            <span style={{ color: C.muted }}>× N/A</span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}`, background: C.panel }}>
                <th style={{ ...thCell, textAlign: "left" }}>Account</th>
                <th style={{ ...thCell, textAlign: "left" }}>Products</th>
                <th style={{ ...thCell, cursor: "pointer" }} onClick={() => setSortKey("base")}>2025</th>
                <th style={{ ...thCell, cursor: "pointer" }} onClick={() => setSortKey("y3")}>Y1</th>
                <th style={{ ...thCell, cursor: "pointer" }} onClick={() => setSortKey("y3")}>Y2</th>
                <th style={{ ...thCell, cursor: "pointer" }} onClick={() => setSortKey("y3")}>Y3</th>
                <th style={{ ...thCell, cursor: "pointer" }} onClick={() => setSortKey("delta")}>Growth</th>
                <th style={thCell} />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ a, series }) => {
                const base = series[0]?.total ?? 0;
                const y3 = series[3]?.total ?? 0;
                const g = y3 - base;
                const gp = base ? g / base : null;
                const isOpen = !!open[a.id];
                return (
                  <Fragment key={a.id}>
                    <tr className="rowhover" style={{ borderBottom: `1px solid ${C.lineSoft}`, background: isOpen ? C.pinkSoft : "transparent" }}>
                      <td style={{ padding: "7px 10px", maxWidth: 250 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <button onClick={() => setOpen((o) => ({ ...o, [a.id]: !isOpen }))}
                            title={isOpen ? "Collapse" : "Open numbers"} aria-expanded={isOpen}
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: isOpen ? C.purple : C.muted, fontFamily: BODY, fontSize: 11, fontWeight: isOpen ? 700 : 400, padding: 0, width: 12 }}>
                            {isOpen ? "▾" : "▸"}
                          </button>
                          <input
                            id={`acct-${a.id}-name`} name={`acct-${a.id}-name`} aria-label="Account name"
                            value={a.name} onChange={(e: ChangeEvent<HTMLInputElement>) => patch(a.id, { name: e.target.value })}
                            placeholder="Account name"
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
                      <td style={{ ...tdCell, color: C.muted }}>{money(base)}</td>
                      <td style={tdCell}>{money(series[1]?.total ?? 0)}</td>
                      <td style={tdCell}>{money(series[2]?.total ?? 0)}</td>
                      <td style={{ ...tdCell, fontWeight: 600 }}>{money(y3)}</td>
                      <td style={{ ...tdCell, color: g > 0 ? C.live : g < 0 ? C.red : C.muted }}>
                        {g >= 0 ? "+" : ""}{money(g)}
                        {gp != null && <span style={{ color: C.muted, fontSize: 11 }}> {gp >= 0 ? "+" : ""}{pct(gp)}</span>}
                      </td>
                      <td style={{ ...tdCell, width: 28 }}>
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
                  </Fragment>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 28, textAlign: "center", color: C.muted, fontSize: 13 }}>
                  No account matches “{query}”. Clear the filter, or add it as a new row.
                </td></tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1.5px solid ${C.ink}`, background: C.panel }}>
                <td style={{ padding: "10px", fontFamily: BODY, fontSize: 13.5, fontWeight: 700 }}>Book total</td>
                <td style={{ padding: "10px", fontFamily: BODY, fontSize: 11.5, color: C.muted }}>
                  {liveCount} live · {targetCount} target
                </td>
                {totals.years.map((v, i) => (
                  <td key={i} style={{ ...tdCell, fontWeight: i === 3 ? 700 : 500, fontSize: 13, color: i === 0 ? C.ink2 : C.ink }}>{money(v)}</td>
                ))}
                <td style={{ ...tdCell, color: C.live, fontWeight: 600 }}>
                  +{money((totals.years[3] ?? 0) - (totals.years[0] ?? 0))}
                </td>
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
  );
}
