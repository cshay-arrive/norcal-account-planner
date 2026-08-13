/* Style factories shared across pages. Kept out of the component files so a
   .tsx module only ever exports components. */

import type { CSSProperties } from "react";

import { BODY, C, R, Rsm } from "./tokens";

/** A header or toolbar button. `primary` fills it with brand purple. */
export const btn = (primary?: boolean): CSSProperties => ({
  fontFamily: BODY, fontSize: 12.5, fontWeight: primary ? 700 : 500,
  padding: "8px 14px", borderRadius: R, cursor: "pointer",
  background: primary ? C.purple : C.panel, color: primary ? "#fff" : C.ink,
  border: `1px solid ${primary ? C.purple : C.line}`,
});

/** A small toggle in a filter group. `on` marks the active choice. */
export const pill = (on: boolean): CSSProperties => ({
  fontFamily: BODY, fontSize: 12, fontWeight: on ? 700 : 400, padding: "5px 10px",
  borderRadius: Rsm, cursor: "pointer",
  background: on ? C.pink : "transparent", color: on ? C.aubergine : C.ink,
  border: `1px solid ${on ? C.pink : C.line}`,
});

/** Right-aligned table header cell. */
export const thCell: CSSProperties = {
  textAlign: "right", padding: "9px 10px", fontFamily: BODY, fontSize: 11.5,
  color: C.muted, fontWeight: 400, whiteSpace: "nowrap",
};

/** Right-aligned table body cell. */
export const tdCell: CSSProperties = {
  textAlign: "right", padding: "7px 10px", fontFamily: BODY, fontSize: 12.5,
  color: C.ink, whiteSpace: "nowrap",
};

/** A dropdown, sized to fill its Field. */
export const selectStyle = (enabled = true): CSSProperties => ({
  width: "100%", height: 30, fontFamily: BODY, fontSize: 12, padding: "0 6px",
  border: `1px solid ${C.line}`, borderRadius: Rsm,
  background: enabled ? C.panel : C.tint, color: C.ink,
});

/** A bare button that reads as a link — used for account names in tables. */
export const linkBtn = (size = 13): CSSProperties => ({
  border: "none", background: "transparent", cursor: "pointer", padding: 0,
  textAlign: "left", fontFamily: BODY, fontSize: size, color: C.ink,
});

/** The small magenta "Clear" / "Reset" action in a panel header. */
export const quietAction: CSSProperties = {
  border: "none", background: "transparent", cursor: "pointer",
  fontFamily: BODY, fontSize: 11.5, color: C.magenta, padding: 0,
};
