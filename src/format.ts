/* Display helpers. Every figure in the UI runs through one of these. */

export const money = (n: number): string => {
  const v = Number(n) || 0;
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}k`;
  return `${s}$${a.toFixed(0)}`;
};
export const dollars = (n: number): string => "$" + Math.round(Number(n) || 0).toLocaleString();
export const pct = (n: number, d = 0): string => `${((Number(n) || 0) * 100).toFixed(d)}%`;
export const cents = (n: number): string => `$${(Number(n) || 0).toFixed(2)}`;
export const cents3 = (n: number): string => `$${(Number(n) || 0).toFixed(3)}`;
export const nInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString();
