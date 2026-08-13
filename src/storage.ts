/* Persistence.
   In the Claude artifact sandbox the app used window.storage, which does not
   exist in a browser. This adapter uses localStorage and degrades to
   in-memory when storage is unavailable (Safari private mode, blocked
   third-party contexts), so the app still runs for the session. */

import type { Account, Settings } from "./types";

const KEY = "norcalbook:v1";

export interface Book {
  accounts: Account[];
  settings: Settings;
}

let memory: string | null = null;

function backing(): Storage | null {
  try {
    const probe = "__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadBook(): Book | null {
  try {
    const store = backing();
    const raw = store ? store.getItem(KEY) : memory;
    if (!raw) return null;
    return JSON.parse(raw) as Book;
  } catch {
    return null;
  }
}

export function saveBook(book: Book): boolean {
  const raw = JSON.stringify(book);
  try {
    const store = backing();
    if (store) {
      store.setItem(KEY, raw);
    } else {
      memory = raw;
    }
    return true;
  } catch {
    /* Most often the 5MB quota. Keep the session usable rather than throwing. */
    memory = raw;
    return false;
  }
}

export function clearBook(): void {
  memory = null;
  try {
    backing()?.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
