/* The left rail. Scenario assumptions travel with you on every page; the panel
   below them changes to match the page in view. */

import type { ChangeEvent } from "react";

import { BODY, C, R, Rsm, U } from "../tokens";
import { cents, dollars, money, pct } from "../format";
import { MODEL_LABEL, PRODUCTS } from "../model";
import { btn, pill, quietAction, selectStyle } from "../styles";
import { Check, Field, Info, Label, Num, Slider, Text } from "../ui";
import type {
  EconModelId, FlagFilter, PageId, ProductId, ProductState, Settings, SortKey, Totals,
} from "../types";

const SORT_OPTIONS: { k: SortKey; label: string }[] = [
  { k: "y3", label: "Year 3" },
  { k: "base", label: "2025" },
  { k: "delta", label: "Growth $" },
  { k: "upside", label: "Product upside" },
  { k: "name", label: "A–Z" },
];

const FLAG_OPTIONS: { k: FlagFilter; label: string }[] = [
  { k: "all", label: "All" },
  { k: "overrides", label: "Priced separately" },
  { k: "nocontract", label: "No contract date" },
  { k: "atrisk", label: "Renewal risk" },
];

const panelStyle = { background: C.panel, borderRadius: R, padding: U, marginBottom: U };
const panelTitle = { fontFamily: BODY, fontSize: 14.5, fontWeight: 700, color: C.purple };

export function Rail({
  page, s, setS, scenarioOpen, setScenarioOpen, activeLevers, leversTouched, resetLevers,
  totals, accountCount, visibleCount, overrideCount,
  query, setQuery, sortKey, setSortKey,
  filterProduct, setFilterProduct, filterState, setFilterState, flagFilter, setFlagFilter,
  productPage, setPage, setProductPage, showAllOnProduct, setShowAllOnProduct,
  onlyMissingContracts, setOnlyMissingContracts,
}: {
  page: PageId; s: Settings; setS: (s: Settings) => void;
  scenarioOpen: boolean; setScenarioOpen: (v: boolean) => void;
  activeLevers: string[]; leversTouched: number; resetLevers: () => void;
  totals: Totals; accountCount: number; visibleCount: number;
  overrideCount: Record<ProductId, number>;
  query: string; setQuery: (v: string) => void;
  sortKey: SortKey; setSortKey: (k: SortKey) => void;
  filterProduct: ProductId | ""; setFilterProduct: (p: ProductId | "") => void;
  filterState: ProductState; setFilterState: (v: ProductState) => void;
  flagFilter: FlagFilter; setFlagFilter: (v: FlagFilter) => void;
  productPage: ProductId; setPage: (p: PageId) => void; setProductPage: (p: ProductId) => void;
  showAllOnProduct: boolean; setShowAllOnProduct: (v: boolean) => void;
  onlyMissingContracts: boolean; setOnlyMissingContracts: (v: boolean) => void;
}) {
  const y3 = totals.years[3] ?? 0;
  const y0 = totals.years[0] ?? 0;
  const growthPct = y0 ? (y3 - y0) / y0 : 0;
  const productEcon = s.econ[productPage];
  const productLocked = productPage === "MPP" || productEcon.model === "accountFee";

  const rateLabel = productEcon.model === "flat" ? "Annual licence"
    : productEcon.model === "bps" ? "Basis points"
      : productEcon.model === "pctMpp" ? "Percent of MPP revenue"
        : productEcon.model === "perStation" ? "Per station, per year"
          : "Per MPP transaction";

  return (
    <aside className="rail">
      {/* ── scenario levers ── */}
      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={panelTitle}>Scenario</span>
          {leversTouched > 0 && (
            <button onClick={resetLevers} style={quietAction}>Reset {leversTouched}</button>
          )}
        </div>

        {scenarioOpen ? (
          <>
            <Info style={{ marginBottom: U * 0.8 }}>Applied to every account on top of its own numbers.</Info>
            <div style={{ display: "flex", flexDirection: "column", gap: U * 0.8 }}>
              <Slider id="lever-feeBump" label="Fee increase, book-wide" value={s.feeBump} min={0} max={0.25} step={0.01}
                onChange={(v) => setS({ ...s, feeBump: v })} format={(v) => `+${cents(v)} / trx`} />
              <Slider id="lever-growthDelta" label="Transaction volume growth" value={s.growthDelta} min={-0.15} max={0.25} step={0.01}
                onChange={(v) => setS({ ...s, growthDelta: v })} format={(v) => `${v >= 0 ? "+" : ""}${pct(v, 0)} vs plan`} />
              <Slider id="lever-adoptionDelta" label="MPP adoption target lift" value={s.adoptionDelta} min={-0.2} max={0.4} step={0.01}
                onChange={(v) => setS({ ...s, adoptionDelta: v })} format={(v) => `${v >= 0 ? "+" : ""}${pct(v, 0)} pts`} />
              <Slider id="lever-defaultGoLive" label="Targets go live in year" value={s.defaultGoLive} min={1} max={3} step={1}
                onChange={(v) => setS({ ...s, defaultGoLive: v })} format={(v) => `Year ${v}`} />
              <Slider id="lever-winProb" label="Win probability on targets" value={s.winProb} min={0} max={100} step={5}
                onChange={(v) => setS({ ...s, winProb: v })} format={(v) => `${v}%`} />
            </div>

            <Check id="lever-riskWeight" checked={s.riskWeight} onChange={(v) => setS({ ...s, riskWeight: v })}
              style={{ marginTop: U * 0.8, paddingTop: U * 0.6, borderTop: `1px solid ${C.lineSoft}` }}>
              Risk-weight target products
            </Check>

            <div style={{ marginTop: U * 0.6, paddingTop: U * 0.6, borderTop: `1px solid ${C.lineSoft}` }}>
              <Check id="lever-elasticityOn" checked={s.elasticityOn} onChange={(v) => setS({ ...s, elasticityOn: v })}
                style={{ marginBottom: s.elasticityOn ? U * 0.6 : 0 }}>
                Fee costs adoption
              </Check>
              {s.elasticityOn && (
                <>
                  <Slider id="lever-feeElasticity" label="Adoption elasticity to fee" value={s.feeElasticity} min={-0.6} max={0} step={0.05}
                    onChange={(v) => setS({ ...s, feeElasticity: v })} format={(v) => v.toFixed(2)} />
                  <Info style={{ fontSize: 10.5, marginTop: 4 }}>
                    A 50% fee rise moves adoption {pct(Math.abs(s.feeElasticity) * 0.5, 1)} lower, relative.
                  </Info>
                </>
              )}
            </div>

            {page !== "overview" && (
              <button onClick={() => setScenarioOpen(false)} style={{ ...btn(), width: "100%", marginTop: U * 0.7 }}>
                Collapse scenario
              </button>
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
              Year 3 <b>{money(y3)}</b> <span style={{ color: C.muted }}>· {pct(growthPct)} over 2025</span>
            </div>
            <button onClick={() => setScenarioOpen(true)} style={{ ...btn(), width: "100%" }}>Adjust assumptions</button>
          </>
        )}
      </div>

      {/* ── Overview: the book's pricing defaults ── */}
      {page === "overview" && (
        <div style={panelStyle}>
          <span style={panelTitle}>Product economics</span>
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
                    {locked ? "account fee"
                      : e.model === "bps" ? `${e.rate} bps`
                        : e.model === "pctMpp" ? `${e.rate}%`
                          : e.model === "flat" ? dollars(e.rate)
                            : e.model === "perStation" ? `${dollars(e.rate)}/st`
                              : cents(e.rate)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Accounts: filters ── */}
      {page === "accounts" && (
        <div style={panelStyle}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={panelTitle}>Filter accounts</span>
            {(query || filterProduct || flagFilter !== "all") && (
              <button onClick={() => { setQuery(""); setFilterProduct(""); setFilterState("LIVE"); setFlagFilter("all"); }}
                style={quietAction}>Clear</button>
            )}
          </div>
          <Info style={{ marginBottom: U * 0.7 }}>{visibleCount} of {accountCount} shown</Info>

          <div style={{ display: "flex", flexDirection: "column", gap: U * 0.7 }}>
            <Field label="Search by name" htmlFor="filter-search">
              {/* Placeholder must stay generic — this string ships in the public bundle. */}
              <Text id="filter-search" value={query} onChange={setQuery} placeholder="Type a name…" />
            </Field>

            <div>
              <Label style={{ fontSize: 11, color: C.ink, marginBottom: 4 }}>Sort by</Label>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {SORT_OPTIONS.map((o) => (
                  <button key={o.k} onClick={() => setSortKey(o.k)} aria-pressed={sortKey === o.k} style={pill(sortKey === o.k)}>{o.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Product" htmlFor="filter-product">
                <select id="filter-product" name="filter-product" value={filterProduct}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterProduct(e.target.value as ProductId | "")}
                  style={selectStyle()}>
                  <option value="">Any</option>
                  {PRODUCTS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Is" htmlFor="filter-state">
                <select id="filter-state" name="filter-state" value={filterState}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterState(e.target.value as ProductState)}
                  disabled={!filterProduct} style={selectStyle(!!filterProduct)}>
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
                {FLAG_OPTIONS.map((o) => (
                  <button key={o.k} onClick={() => setFlagFilter(o.k)} aria-pressed={flagFilter === o.k} style={pill(flagFilter === o.k)}>{o.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Products: pricing and view for the product in view ── */}
      {page === "products" && (
        <div style={panelStyle}>
          <span style={panelTitle}>{productPage} pricing</span>
          <Info style={{ marginTop: 2, marginBottom: U * 0.7 }}>
            The book default. {overrideCount[productPage] > 0
              ? `${overrideCount[productPage]} account${overrideCount[productPage] > 1 ? "s" : ""} priced separately.`
              : "No account overrides yet."}
          </Info>

          <div style={{ display: "flex", flexDirection: "column", gap: U * 0.7 }}>
            <Field label="How it earns" htmlFor="book-model">
              <select id="book-model" name="book-model" value={productEcon.model}
                onChange={(ev: ChangeEvent<HTMLSelectElement>) => setS({ ...s, econ: { ...s.econ, [productPage]: { ...productEcon, model: ev.target.value as EconModelId } } })}
                style={selectStyle()}>
                {(Object.keys(MODEL_LABEL) as EconModelId[]).map((m) => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}
              </select>
            </Field>
            {productLocked ? (
              <Info>Priced from each account's own transaction fee, so there is no book rate to set.</Info>
            ) : (
              <Field label={rateLabel} htmlFor="book-rate"
                hint={`Y3 contribution ${money(totals.byProduct[productPage]?.[3] ?? 0)}`}>
                <Num id="book-rate" value={productEcon.rate}
                  onChange={(v) => setS({ ...s, econ: { ...s.econ, [productPage]: { ...productEcon, rate: v } } })}
                  step={productEcon.model === "bps" ? 1 : productEcon.model === "flat" ? 100 : productEcon.model === "pctMpp" ? 0.5 : 0.01}
                  prefix={productEcon.model === "flat" || productEcon.model === "perTrx" || productEcon.model === "perStation" ? "$" : ""}
                  suffix={productEcon.model === "bps" ? "bps" : productEcon.model === "pctMpp" ? "%" : ""} w="100%" />
              </Field>
            )}
            <Check id="show-all-on-product" checked={showAllOnProduct} onChange={setShowAllOnProduct}
              style={{ paddingTop: U * 0.5, borderTop: `1px solid ${C.lineSoft}` }}>
              Show accounts without it
            </Check>
            <Info style={{ fontSize: 10.5 }}>Greyed rows carry an “if adopted” figure instead of revenue.</Info>
          </div>
        </div>
      )}

      {/* ── Contracts: renewal assumptions ── */}
      {page === "contracts" && (
        <div style={panelStyle}>
          <span style={panelTitle}>Renewal assumptions</span>
          <Info style={{ marginTop: 2, marginBottom: U * 0.7 }}>
            {totals.unknownContracts} of {accountCount} accounts have no end date, so they carry no risk yet.
          </Info>
          <div style={{ display: "flex", flexDirection: "column", gap: U * 0.7 }}>
            <Check id="renewal-risk" checked={s.renewalRisk} onChange={(v) => setS({ ...s, renewalRisk: v })}>
              Weight for renewal risk
            </Check>
            {s.renewalRisk && (
              <>
                <Slider id="lever-defaultRenewProb" label="Default renewal probability" value={s.defaultRenewProb}
                  min={40} max={100} step={5}
                  onChange={(v) => setS({ ...s, defaultRenewProb: v })} format={(v) => `${v}%`} />
                <Info style={{ fontSize: 10.5 }}>Applies from the year after each contract ends. Per-account odds override it.</Info>
              </>
            )}
            <div style={{ paddingTop: U * 0.5, borderTop: `1px solid ${C.lineSoft}` }}>
              <div style={{ fontFamily: BODY, fontSize: 12.5, color: C.ink }}>
                Held back at Y3 <b style={{ color: C.aubergine }}>{money(totals.atRisk[3] ?? 0)}</b>
              </div>
              <div style={{ fontFamily: BODY, fontSize: 12.5, color: C.ink, marginTop: 3 }}>
                Over ceilings <b style={{ color: C.aubergine }}>{(totals.capped[3] ?? 0) > 0 ? money(totals.capped[3] ?? 0) : "none"}</b>
              </div>
            </div>
            <Check id="only-missing-contracts" checked={onlyMissingContracts} onChange={setOnlyMissingContracts}
              style={{ paddingTop: U * 0.5, borderTop: `1px solid ${C.lineSoft}` }}>
              Only accounts missing a date
            </Check>
          </div>
        </div>
      )}
    </aside>
  );
}
