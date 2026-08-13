/* Shared UI primitives. Every input here requires an `id`, so a new field
   cannot be added without one — screen readers need it to announce the field,
   and browsers need it to keep autofill from guessing. `name` defaults to the
   id, which is what form tooling reads. */

import type { ChangeEvent, CSSProperties, ReactNode } from "react";

import { BODY, C, DISPLAY, MONO, R, Rsm, U } from "./tokens";
import { dollars, money } from "./format";
import type { BuildParts, ProductState, WaterfallResult } from "./types";

/* `htmlFor` is written `string | undefined` rather than `htmlFor?: string`
   because Field forwards its own optional value straight through, and under
   exactOptionalPropertyTypes "absent" and "present but undefined" are
   different types. */
export const Label = ({ children, style, htmlFor }: {
  children: ReactNode; style?: CSSProperties; htmlFor?: string | undefined;
}) => {
  const css: CSSProperties = { fontFamily: BODY, fontSize: 12, fontWeight: 700, color: C.purple, ...style };
  return htmlFor
    ? <label htmlFor={htmlFor} style={css}>{children}</label>
    : <div style={css}>{children}</div>;
};

/* Info text: smallest in the hierarchy. */
export const Info = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontFamily: BODY, fontSize: 11, color: C.muted, ...style }}>{children}</div>
);

/* Arrive's four-point star, tiled as a light background motif. */
export const SpacePattern = ({ fill, size = 30, opacity = 1 }: {
  fill: string; size?: number; opacity?: number;
}) => (
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

const CHIP_LOOK: Record<ProductState, { bg: string; fg: string; bd: string; mark: string }> = {
  LIVE: { bg: C.purple, fg: "#FFFFFF", bd: C.purple, mark: "●" },
  TARGET: { bg: C.pink, fg: C.aubergine, bd: C.pink, mark: "○" },
  "N/A": { bg: C.surface, fg: C.na, bd: C.line, mark: "×" },
  "": { bg: "transparent", fg: "rgba(22,18,26,0.3)", bd: C.line, mark: "·" },
};

export function Chip({ state, onClick, label, title }: {
  state: ProductState; onClick: () => void; label: string; title?: string;
}) {
  const m = CHIP_LOOK[state] ?? CHIP_LOOK[""];
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

export function Num({ id, name, value, onChange, step = 1, min, max, prefix, suffix, w = 96, ariaLabel }: {
  id: string; name?: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number;
  prefix?: string; suffix?: string; w?: number | string; ariaLabel?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.line}`, borderRadius: Rsm, background: C.panel, height: 30, width: w }}>
      {prefix && <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, paddingLeft: 6 }}>{prefix}</span>}
      <input
        id={id} name={name ?? id} aria-label={ariaLabel}
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

export function Text({ id, name, value, onChange, placeholder, w = "100%", ariaLabel }: {
  id: string; name?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; w?: number | string; ariaLabel?: string;
}) {
  return (
    <input
      id={id} name={name ?? id} aria-label={ariaLabel}
      type="text" value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        border: `1px solid ${C.line}`, borderRadius: Rsm, background: C.panel, height: 30, width: w,
        fontFamily: BODY, fontSize: 12, color: C.ink, padding: "0 8px", outline: "none",
      }} />
  );
}

/** Labelled wrapper. Pass `htmlFor` matching the child input's id so clicking
    the label focuses the field. */
export const Field = ({ label, hint, children, htmlFor }: {
  label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <Label htmlFor={htmlFor} style={{ fontSize: 11, color: C.ink }}>{label}</Label>
    {children}
    {hint && <Info style={{ fontSize: 10.5 }}>{hint}</Info>}
  </div>
);

export function Slider({ id, name, label, value, onChange, min, max, step, format }: {
  id: string; name?: string; label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <Label htmlFor={id} style={{ fontSize: 11, color: C.ink }}>{label}</Label>
        <span style={{ fontFamily: BODY, fontSize: 12.5, color: C.purple, fontWeight: 700 }}>{format(value)}</span>
      </div>
      <input
        id={id} name={name ?? id}
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.purple, height: 18 }} />
    </div>
  );
}

/** A checkbox with its label. */
export function Check({ id, name, checked, onChange, children, style }: {
  id: string; name?: string; checked: boolean; onChange: (v: boolean) => void;
  children: ReactNode; style?: CSSProperties;
}) {
  return (
    <label htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", ...style }}>
      <input
        id={id} name={name ?? id} type="checkbox" checked={checked}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export function Kpi({ label, value, note, big }: {
  label: string; value: string; note?: ReactNode; big?: boolean;
}) {
  return (
    <div>
      <Label style={{ fontSize: 11.5, color: C.ink }}>{label}</Label>
      <div style={{ fontFamily: DISPLAY, fontSize: big ? 36 : 28, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.05, marginTop: 4, color: big ? C.purple : C.ink }}>{value}</div>
      {note && <Info style={{ fontSize: 11, marginTop: 3 }}>{note}</Info>}
    </div>
  );
}

export function Panel({ title, subtitle, open, toggle, children }: {
  title: string; subtitle?: string; open: boolean; toggle: () => void; children: ReactNode;
}) {
  return (
    <div style={{ background: C.panel, borderRadius: R, marginBottom: U }}>
      <button onClick={toggle} aria-expanded={open} style={{
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

export function TabBar({ tabs, tab, setTab }: {
  tabs: { id: string; label: string; dot?: string }[]; tab: string; setTab: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: U * 0.8 }}>
      {tabs.map((t) => {
        const on = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={on}
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

/* Signature element: the revenue build shown as containers parked on the grid.
   The container is the brand device; the extended palette is sanctioned for graphs. */
export function BuildStrip({ parts, total }: {
  parts: BuildParts | WaterfallResult; total: number;
}) {
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
