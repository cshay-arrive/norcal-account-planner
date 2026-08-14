/* Owns all book state, derives every roll-up, and lays out the page. The four
   pages and the rail are presentational — they receive data and callbacks and
   render. Nothing here draws a table. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { BODY, C, DISPLAY, R, Rsm, U } from "./tokens";
import { cents, pct } from "./format";
import { BOOKED_2025, DEMO_LABEL, SEED } from "./seed";
import { downloadBook, parseBookFile } from "./bookFile";
import { clearBook, loadBook, saveBook } from "./storage";
import {
  DEFAULT_ECON, DEFAULT_SETTINGS, PLAN_YEARS, PRODUCTS, STATES,
  accountSeries, calc, hasOverrides, normalize, renewalYear, resolveEcon, waterfall,
} from "./model";
import { btn } from "./styles";
import { AccountsPage } from "./pages/AccountsPage";
import { ContractsPage } from "./pages/ContractsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PageTabs } from "./pages/PageTabs";
import { ProductPage, ProductPicker } from "./pages/ProductsPage";
import { Rail } from "./pages/Rail";
import type {
  Account, AccountRow, FlagFilter, Lever, OpenMap, PageId, Patch,
  ProductId, ProductState, Rate, Settings, SettingsKey, SortKey, Totals,
} from "./types";

/* Which scenario levers count as "touched" for the rail's reset badge. */
const LEVER_KEYS: SettingsKey[] = [
  "feeBump", "growthDelta", "adoptionDelta", "defaultGoLive", "winProb",
  "riskWeight", "elasticityOn", "feeElasticity", "renewalRisk", "defaultRenewProb",
];

export default function AccountBookPlanner() {
  const [accounts, setAccounts] = useState<Account[]>(() => SEED.map(normalize));
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [open, setOpen] = useState<OpenMap>({});
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("y3");
  const [showLevers, setShowLevers] = useState(true);
  const [page, setPage] = useState<PageId>("overview");
  const [showAllOnProduct, setShowAllOnProduct] = useState(true);
  const [productPage, setProductPage] = useState<ProductId>("MPP");
  const [scenarioOpen, setScenarioOpen] = useState(true);
  const [filterProduct, setFilterProduct] = useState<ProductId | "">("");
  const [filterState, setFilterState] = useState<ProductState>("LIVE");
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("all");
  const [onlyMissingContracts, setOnlyMissingContracts] = useState(false);
  const [status, setStatus] = useState("");
  /* The 2025 booked figure travels with the book, so a loaded book reconciles
     against its own number rather than the demo one. */
  const [booked2025, setBooked2025] = useState(BOOKED_2025);
  const [bookLabel, setBookLabel] = useState(DEMO_LABEL);
  const [loadError, setLoadError] = useState("");
  const loaded = useRef<boolean>(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const isDemo = bookLabel === DEMO_LABEL;

  /* load saved book */
  useEffect(() => {
    const d = loadBook();
    if (d) {
      if (d.accounts) setAccounts(d.accounts.map(normalize));
      if (d.settings) {
        setS({ ...DEFAULT_SETTINGS, ...d.settings, econ: { ...DEFAULT_ECON, ...d.settings.econ } });
      }
      if (typeof d.booked2025 === "number") setBooked2025(d.booked2025);
      if (d.label) setBookLabel(d.label);
      setStatus("Loaded your saved book");
    }
    loaded.current = true;
  }, []);

  /* save on change, debounced */
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      if (saveBook({ accounts, settings: s, booked2025, label: bookLabel })) {
        setStatus("Saved");
        setTimeout(() => setStatus(""), 1400);
      } else {
        setStatus("Kept for this session only");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [accounts, s, booked2025, bookLabel]);

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
      const next = STATES[(STATES.indexOf(cur) + 1) % STATES.length] ?? "";
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
    setBooked2025(BOOKED_2025);
    setBookLabel(DEMO_LABEL);
    setLoadError("");
    clearBook();
    setStatus("Back to sample data");
  };

  /* Reads a book from the user's own computer. Nothing is uploaded — the file
     is parsed in the browser and kept in this browser's local storage. */
  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    /* Clear the input so picking the same file twice still fires a change. */
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => setLoadError(`Could not read "${file.name}". Check the file and try again.`);
    reader.onload = () => {
      const result = parseBookFile(String(reader.result ?? ""), file.name);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      const book = result.book;
      setAccounts(book.accounts.map(normalize));
      if (book.settings) {
        setS({ ...DEFAULT_SETTINGS, ...book.settings, econ: { ...DEFAULT_ECON, ...book.settings.econ } });
      }
      setBooked2025(book.booked2025);
      setBookLabel(book.label);
      setLoadError("");
      setOpen({});
      setStatus(`Loaded ${book.accounts.length} accounts`);
    };
    reader.readAsText(file);
  };

  const saveBookFile = () => {
    downloadBook(accounts, s, booked2025, bookLabel === DEMO_LABEL ? "book" : bookLabel);
    setStatus("Book saved to your downloads");
    setTimeout(() => setStatus(""), 2200);
  };

  /* ── computed ── */
  const rows = useMemo<AccountRow[]>(
    () => accounts.map((a) => ({
      a,
      series: accountSeries(a, s),
      rateSeries: PLAN_YEARS.map((y) => calc(a, s, y, { renewal: false, cap: false })),
      wf: waterfall(a, s),
    })),
    [accounts, s]
  );

  const totals = useMemo<Totals>(() => {
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
        t.years[i] = (t.years[i] ?? 0) + yr.total;
        t.atRisk[i] = (t.atRisk[i] ?? 0) + yr.atRisk;
        t.capped[i] = (t.capped[i] ?? 0) + yr.capped;
        for (const p of PRODUCTS) {
          const col = t.byProduct[p];
          col[i] = (col[i] ?? 0) + yr.byProduct[p];
        }
        if (liveMpp) {
          /* Rates are quoted before cap and renewal weighting, so the blended
             fee stays a number you could put in front of a customer. */
          const q = r.rateSeries[i];
          if (!q) return;
          t.mppTrx[i] = (t.mppTrx[i] ?? 0) + q.mppTrx;
          t.mppVolume[i] = (t.mppVolume[i] ?? 0) + q.volume;
          t.mppRev[i] = (t.mppRev[i] ?? 0) + q.byProduct.MPP;
          if (i === 3) t.trxLost += (q.adoptionLoss || 0) * q.addressable;
        }
      });
      t.base += r.wf.base; t.volume += r.wf.volume; t.fee += r.wf.fee;
      t.adoption += r.wf.adoption; t.newProducts += r.wf.newProducts;
    }
    return t;
  }, [rows]);

  const levers = useMemo<Lever[]>(() => {
    const out: Lever[] = [];
    for (const r of rows) {
      for (const p of PRODUCTS) {
        const v = r.series[3]?.byProduct[p] ?? 0;
        if (r.a.products[p] === "TARGET" && v > 0) {
          out.push({ kind: p, name: r.a.name, value: v, id: r.a.id });
        }
      }
      if (r.wf.fee > 0) out.push({ kind: "Fee increase", name: r.a.name, value: r.wf.fee, id: r.a.id });
      if (r.wf.adoption > 0) out.push({ kind: "Adoption lift", name: r.a.name, value: r.wf.adoption, id: r.a.id });
    }
    return out.sort((x, y) => y.value - x.value).slice(0, 12);
  }, [rows]);

  const expiring = useMemo(
    () => rows.filter((r) => renewalYear(r.a)),
    [rows]
  );

  const visible = useMemo(() => {
    const f = rows.filter((r) => {
      if (!r.a.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (filterProduct && (r.a.products[filterProduct] || "") !== filterState) return false;
      if (flagFilter === "overrides" && !hasOverrides(r.a)) return false;
      if (flagFilter === "nocontract" && r.a.contractEnd) return false;
      if (flagFilter === "atrisk" && !(renewalYear(r.a) && (r.series[3]?.atRisk ?? 0) > 0)) return false;
      return true;
    });
    const keys: Record<SortKey, (r: AccountRow) => number | string> = {
      y3: (r) => -(r.series[3]?.total ?? 0),
      base: (r) => -(r.series[0]?.total ?? 0),
      delta: (r) => -((r.series[3]?.total ?? 0) - (r.series[0]?.total ?? 0)),
      upside: (r) => -r.wf.newProducts,
      name: (r) => r.a.name.toLowerCase(),
    };
    const key = keys[sortKey];
    return f.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0));
  }, [rows, query, sortKey, filterProduct, filterState, flagFilter]);

  const exportCsv = () => {
    const head = ["Account", ...PRODUCTS, "2025", "Year 1", "Year 2", "Year 3", "Growth $", "Growth %",
      "Addressable trx", "Adoption now", "Adoption Y3", "Fee now", "Fee target", "Fee year", "Trx growth", "FB stations", "FB rate",
      "Contract end", "Renewal prob", "NTE cap", "Fee elasticity", "Y3 held back", "Y3 over ceiling", "Pricing overrides", "Note"];
    const lines = [head.join(",")];
    for (const r of rows) {
      const { a, series } = r;
      const base = series[0]?.total ?? 0;
      const y3 = series[3]?.total ?? 0;
      const g = y3 - base;
      lines.push([
        `"${a.name.replace(/"/g, '""')}"`, ...PRODUCTS.map((p) => a.products[p] || ""),
        base.toFixed(0), (series[1]?.total ?? 0).toFixed(0), (series[2]?.total ?? 0).toFixed(0), y3.toFixed(0),
        g.toFixed(0), base ? (g / base).toFixed(3) : "",
        a.addressable, a.adoptionNow, a.adoptionTarget, a.feeNow, a.feeTarget, a.feeYear, a.growth,
        a.fbStations, a.fbRate,
        a.contractEnd, a.renewProb == null ? s.defaultRenewProb : a.renewProb, a.nteCap,
        a.elasticity == null ? s.feeElasticity : a.elasticity,
        (series[3]?.atRisk ?? 0).toFixed(0), (series[3]?.capped ?? 0).toFixed(0),
        `"${PRODUCTS.filter((p) => typeof a.econ[p] === "number" || !!a.econModel[p])
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
      c[p] = accounts.filter((a) => typeof a.econ[p] === "number" || !!a.econModel[p]).length;
    }
    return c;
  }, [accounts]);

  const liveCounts = useMemo(() => {
    const c = {} as Record<ProductId, number>;
    for (const p of PRODUCTS) c[p] = accounts.filter((a) => a.products[p] === "LIVE").length;
    return c;
  }, [accounts]);

  const productRevenue = useMemo(() => {
    const c = {} as Record<ProductId, number>;
    for (const p of PRODUCTS) c[p] = totals.byProduct[p]?.[3] ?? 0;
    return c;
  }, [totals]);

  const activeLevers = useMemo(() => {
    const out: string[] = [];
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

  const leversTouched = LEVER_KEYS.filter((k) => s[k] !== DEFAULT_SETTINGS[k]).length;
  const resetLevers = () =>
    setS({ ...s, ...(Object.fromEntries(LEVER_KEYS.map((k) => [k, DEFAULT_SETTINGS[k]])) as Partial<Settings>) });

  /* Transaction-weighted, so a big account moves the blend more than a small one. */
  const rates: Rate[] = PLAN_YEARS.map((i) => {
    const trx = totals.mppTrx[i] ?? 0;
    const size = trx ? (totals.mppVolume[i] ?? 0) / trx : 0;
    const fee = trx ? (totals.mppRev[i] ?? 0) / trx : 0;
    return { trx, size, fee, take: size ? fee / size : 0 };
  });

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
        .headernav { position: sticky; top: 0; z-index: 20; padding: ${U / 2}px 0 ${U}px; background: linear-gradient(${C.ground} 76%, rgba(244,242,245,0)); }
        @media (max-width: 940px) {
          .shell { grid-template-columns: minmax(0, 1fr); }
          .rail { position: static; max-height: none; }
        }
        @media (prefers-reduced-motion: no-preference) { .rowhover { transition: background 120ms ease; } }
      `}</style>

      <div style={{ maxWidth: 1420, margin: "0 auto", padding: `${U}px ${U}px ${U * 3}px` }}>

        {/* ── masthead ── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: U }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 38, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
                Account book planner
              </h1>
              <span style={{
                fontFamily: BODY, fontSize: 11, fontWeight: 700, borderRadius: Rsm, padding: "3px 8px",
                background: isDemo ? C.tintDeep : C.pink, color: isDemo ? C.muted : C.aubergine,
              }}>
                {bookLabel}
              </span>
              <span style={{ fontFamily: BODY, fontSize: 12, color: C.muted }}>{accounts.length} accounts</span>
            </div>
            <div style={{ fontSize: 13.5, color: C.ink, marginTop: 6, maxWidth: 620 }}>
              Change a number, a product state, or a scenario lever. The three-year projection re-rolls as you type.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span role="status" style={{ fontFamily: BODY, fontSize: 11.5, fontWeight: 700, color: C.purple, minWidth: 60 }}>{status}</span>
            <input ref={fileInput} type="file" accept="application/json,.json" onChange={onPickFile}
              style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
            <button onClick={() => fileInput.current?.click()} style={btn(isDemo)}>Load book</button>
            <button onClick={saveBookFile} style={btn()}>Save book</button>
            <button onClick={addRow} style={btn()}>Add account</button>
            <button onClick={exportCsv} style={btn()}>Export CSV</button>
            <button onClick={resetBook} style={btn()}>Reset</button>
          </div>
        </div>

        {loadError && (
          <div role="alert" style={{
            background: C.pink, borderRadius: R, padding: `${U * 0.6}px ${U * 0.7}px`,
            marginBottom: U, fontSize: 12.5, color: C.ink,
          }}>
            <strong>That file would not load.</strong> {loadError}
          </div>
        )}

        {isDemo && (
          <div style={{
            background: C.panel, border: `1px solid ${C.line}`, borderRadius: R,
            padding: `${U * 0.6}px ${U * 0.7}px`, marginBottom: U, fontSize: 12.5, color: C.ink, lineHeight: 1.6,
          }}>
            <strong style={{ color: C.purple }}>You are looking at sample data.</strong> These six accounts are invented,
            so this page is safe to share. Click <strong>Load book</strong> to open your real book from a file on your
            computer — it is read in your browser and never uploaded. Once loaded, this browser remembers it.
          </div>
        )}

        <PageTabs page={page} setPage={setPage} accountCount={accounts.length}
          contractsBadge={expiring.length || totals.unknownContracts} />

        <div className="shell">
          <Rail
            page={page} s={s} setS={setS}
            scenarioOpen={scenarioOpen} setScenarioOpen={setScenarioOpen}
            activeLevers={activeLevers} leversTouched={leversTouched} resetLevers={resetLevers}
            totals={totals} accountCount={accounts.length} visibleCount={visible.length}
            overrideCount={overrideCount}
            query={query} setQuery={setQuery} sortKey={sortKey} setSortKey={setSortKey}
            filterProduct={filterProduct} setFilterProduct={setFilterProduct}
            filterState={filterState} setFilterState={setFilterState}
            flagFilter={flagFilter} setFlagFilter={setFlagFilter}
            productPage={productPage} setPage={setPage} setProductPage={setProductPage}
            showAllOnProduct={showAllOnProduct} setShowAllOnProduct={setShowAllOnProduct}
            onlyMissingContracts={onlyMissingContracts} setOnlyMissingContracts={setOnlyMissingContracts}
          />

          <div>
            {page === "overview" && (
              <OverviewPage totals={totals} rows={rows} rates={rates} s={s} levers={levers}
                setOpen={setOpen} showLevers={showLevers} setShowLevers={setShowLevers}
                booked2025={booked2025} />
            )}

            {page === "accounts" && (
              <AccountsPage
                visible={visible} rows={rows} accountCount={accounts.length} s={s}
                patch={patch} cycle={cycle} open={open} setOpen={setOpen} removeRow={removeRow}
                totals={totals} setSortKey={setSortKey}
                query={query} filterProduct={filterProduct} filterState={filterState} flagFilter={flagFilter}
              />
            )}

            {page === "products" && (
              <>
                <ProductPicker value={productPage} setValue={setProductPage} counts={liveCounts} revenue={productRevenue} />
                <ProductPage p={productPage} rows={rows} s={s} patch={patch} cycle={cycle}
                  setOpen={setOpen} showAll={showAllOnProduct} />
              </>
            )}

            {page === "contracts" && (
              <ContractsPage rows={rows} s={s} patch={patch} setOpen={setOpen} onlyMissing={onlyMissingContracts} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
