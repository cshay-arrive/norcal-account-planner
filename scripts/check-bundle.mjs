/* Fails the build if anything from a real book ends up in the public bundle.
 *
 * The app is deployed to a public URL, so dist/ is downloadable by anyone. This
 * reads the real account names out of your local private/*.json books (which are
 * gitignored and never deployed) and checks that none of them appear in the
 * built output.
 *
 * If you have no private book on this machine — a CI or Vercel build, or a
 * teammate's checkout — there is nothing to compare against and the check
 * reports that it skipped, rather than pretending it passed.
 */

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const distDir = path.join(root, "dist");
const privateDir = path.join(root, "private");

if (!fs.existsSync(distDir)) {
  console.error("check-bundle: no dist/ folder. Run `npm run build` first.");
  process.exit(1);
}

if (!fs.existsSync(privateDir)) {
  console.log("check-bundle: SKIPPED — no private/ book on this machine to compare against.");
  process.exit(0);
}

/* Every string and number worth protecting, gathered from the local books. */
const secrets = new Set();
for (const file of fs.readdirSync(privateDir).filter((f) => f.endsWith(".json"))) {
  let book;
  try {
    book = JSON.parse(fs.readFileSync(path.join(privateDir, file), "utf8"));
  } catch {
    console.warn(`check-bundle: could not parse private/${file}, skipping it.`);
    continue;
  }
  if (typeof book.booked2025 === "number") secrets.add(String(book.booked2025));
  for (const a of book.accounts ?? []) {
    if (typeof a.name === "string" && a.name.trim()) secrets.add(a.name.trim());
    /* Revenue figures are as identifying as the names. */
    for (const key of ["rev25", "addressable"]) {
      if (typeof a[key] === "number" && a[key] > 999) secrets.add(String(a[key]));
    }
  }
}

if (secrets.size === 0) {
  console.log("check-bundle: SKIPPED — private/ contains no readable book.");
  process.exit(0);
}

/* Read every built file once. */
let haystack = "";
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else haystack += fs.readFileSync(full, "utf8");
  }
};
walk(distDir);

const leaks = [...secrets].filter((s) => haystack.includes(s));

if (leaks.length > 0) {
  console.error(`\ncheck-bundle: FAILED — ${leaks.length} item(s) from a real book are in the public bundle:\n`);
  for (const l of leaks.slice(0, 20)) console.error(`  • ${l}`);
  if (leaks.length > 20) console.error(`  …and ${leaks.length - 20} more`);
  console.error("\nRemove these from src/ before deploying. Real figures must be loaded at runtime.\n");
  process.exit(1);
}

console.log(`check-bundle: PASSED — checked ${secrets.size} protected values, none present in dist/.`);
