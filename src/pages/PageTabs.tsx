/* Top-level navigation between the four pages. */

import { BODY, C, R, Rsm } from "../tokens";
import type { PageId } from "../types";

export function PageTabs({ page, setPage, accountCount, contractsBadge }: {
  page: PageId; setPage: (p: PageId) => void; accountCount: number; contractsBadge: number;
}) {
  const tabs: { id: PageId; label: string; n?: number; warn?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "accounts", label: "Accounts", n: accountCount },
    { id: "products", label: "Products" },
    { id: "contracts", label: "Contracts", n: contractsBadge, warn: true },
  ];
  return (
    <nav className="headernav" aria-label="Pages">
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", background: C.panel, borderRadius: R, padding: 5 }}>
        {tabs.map((t) => {
          const on = page === t.id;
          return (
            <button key={t.id} onClick={() => setPage(t.id)} aria-current={on ? "page" : undefined}
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
