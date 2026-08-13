/* ───── Arrive brand tokens ─────
   Sampled from Arrive Partner Brand Guidelines V1.Q4 2025: cover purple #5F016F,
   heading purple #5E016E, accent pink #FDABE2, white, black body text.
   The guidelines publish no extended palette, so the mid tones below are derived
   tints of the two brand colours, used only for graphs and states. Deep pink is a
   darkened brand pink chosen so it passes contrast as text on white. */
export const C = {
  purple: "#5F016F",
  aubergine: "#3A0044",
  midPurple: "#8A2C99",
  lightPurple: "#B96BC7",
  pink: "#FDABE2",
  pinkSoft: "#FDEBF7",
  tint: "#FAF6FB",
  tintDeep: "#F3E9F6",
  magenta: "#A8106F",
  surface: "#F4F2F5",
  ground: "#F4F2F5",
  panel: "#FFFFFF",
  line: "#E4DEE7",
  lineSoft: "#EFEBF1",
  ink: "#16121A",
  ink2: "rgba(22,18,26,0.66)",
  muted: "rgba(22,18,26,0.55)",
  live: "#5F016F",
  na: "rgba(22,18,26,0.42)",
  red: "#3A0044",
};
export const DISPLAY = "Inter,system-ui,-apple-system,sans-serif";
export const BODY = "Inter,system-ui,-apple-system,sans-serif";
export const MONO = "Inter,system-ui,-apple-system,sans-serif";
/* 5% grid: one unit, and container roundness at 70% of a unit. */
export const U = 20;
export const R = Math.round(U * 0.7);
export const Rsm = Math.round((U / 2) * 0.7);
