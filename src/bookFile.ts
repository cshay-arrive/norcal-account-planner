/* Reading and writing a book file.
 *
 * The real account book lives in a JSON file on the user's own computer, not in
 * this app's code. That is deliberate: anything imported here is compiled into
 * the JavaScript every visitor downloads, so real client revenue must arrive at
 * runtime instead. Loading a book keeps it in that browser's local storage; it
 * is never uploaded anywhere.
 */

import type { Account, AccountSeed, Settings } from "./types";

/** What a .json book file contains. */
export interface BookFile {
  version: number;
  /** Shown in the header so you can tell which book is loaded. */
  label: string;
  /** 2025 revenue as actually booked, for the baseline reconciliation. */
  booked2025: number;
  accounts: AccountSeed[] | Account[];
  /** Optional — scenario levers saved alongside the book. */
  settings?: Partial<Settings>;
}

export type ParseResult =
  | { ok: true; book: BookFile }
  | { ok: false; error: string };

const CURRENT_VERSION = 1;

/* Plain-English validation. The person loading this is an account manager, not
   an engineer, so every failure has to say what is wrong with THEIR file. */
export function parseBookFile(text: string, fileName: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: `"${fileName}" is not a valid JSON file. If you exported it from this app, try exporting again.`,
    };
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: `"${fileName}" does not look like a book file. Expected a set of accounts and settings.` };
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.accounts)) {
    return { ok: false, error: `"${fileName}" has no accounts list, so there is nothing to load.` };
  }
  if (obj.accounts.length === 0) {
    return { ok: false, error: `"${fileName}" contains zero accounts.` };
  }

  const bad = obj.accounts.findIndex(
    (a) => typeof a !== "object" || a === null || typeof (a as { name?: unknown }).name !== "string"
  );
  if (bad !== -1) {
    return { ok: false, error: `Account number ${bad + 1} in "${fileName}" has no name. Every account needs one.` };
  }

  const version = typeof obj.version === "number" ? obj.version : CURRENT_VERSION;
  if (version > CURRENT_VERSION) {
    return {
      ok: false,
      error: `"${fileName}" was saved by a newer version of this app (file version ${version}). Update the app, then try again.`,
    };
  }

  return {
    ok: true,
    book: {
      version,
      label: typeof obj.label === "string" && obj.label.trim() ? obj.label : fileName.replace(/\.json$/i, ""),
      booked2025: typeof obj.booked2025 === "number" ? obj.booked2025 : 0,
      accounts: obj.accounts as AccountSeed[],
      ...(typeof obj.settings === "object" && obj.settings !== null
        ? { settings: obj.settings as Partial<Settings> }
        : {}),
    },
  };
}

/** Save the current book to a .json file the user can keep and re-load. */
export function downloadBook(
  accounts: Account[],
  settings: Settings,
  booked2025: number,
  label: string
): void {
  const payload: BookFile = {
    version: CURRENT_VERSION,
    label,
    booked2025,
    accounts,
    settings,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = url;
  /* Matches the *.book.json gitignore pattern, so a saved book cannot be
     committed by accident even if it lands inside the repo folder. */
  link.download = `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.book.json`;
  link.click();
  URL.revokeObjectURL(url);
}
