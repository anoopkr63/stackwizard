import { defaultSelections } from "./assemble";
import type { WizardSelections } from "./types";

type Bag = Record<string, unknown>;

// Drop every value that matches the defaults, so the link only carries
// what the user actually picked. A fresh page encodes to "" (no ?s= at all).
function stripDefaults(obj: Bag, def: Bag): Bag {
  const out: Bag = {};
  for (const [k, v] of Object.entries(obj)) {
    const d = def[k];
    if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      d !== null &&
      typeof d === "object"
    ) {
      const nested = stripDefaults(v as Bag, d as Bag);
      if (Object.keys(nested).length) out[k] = nested;
    } else if (v !== d) {
      out[k] = v;
    }
  }
  return out;
}

// Encode selections into shareable query params: ?s=<base64url json>
export function encodeSelections(s: WizardSelections): string {
  const minimal = stripDefaults(s as unknown as Bag, defaultSelections() as unknown as Bag);
  if (!Object.keys(minimal).length) return "";
  const json = JSON.stringify(minimal);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function asBag(v: unknown): Bag {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Bag) : {};
}

// --- Short route links: /s/l:typescript+f:nextjs+db:supabase -----------------
// Only non-default picks are encoded, so links stay short and readable.
// Unknown codes are ignored (forward compatible); legacy ?s= links keep working.

const ROUTE_CODES: Record<string, "platform" | "target" | "appName" | "language" | "framework" | "styling" | "packageManager" | "backend" | "database" | "orm" | "auth" | "payments" | "testing" | "cicd" | "ai" | "skills"> = {
  p: "platform",
  t: "target",
  n: "appName",
  l: "language",
  f: "framework",
  s: "styling",
  pm: "packageManager",
  b: "backend",
  db: "database",
  o: "orm",
  au: "auth",
  pay: "payments",
  te: "testing",
  ci: "cicd",
  ai: "ai",
  sk: "skills",
};

export function encodeRoute(s: WizardSelections): string {
  const def = defaultSelections();
  const out: string[] = [];
  const push = (code: string, value: string) => {
    if (value) out.push(`${code}:${encodeURIComponent(value)}`);
  };
  if (s.platform !== def.platform) push("p", s.platform);
  if (s.platform === "mobile" && s.target !== def.target) push("t", s.target ?? "");
  if (s.appName !== def.appName) push("n", s.appName);
  if (s.language) push("l", s.language);
  if (s.framework) push("f", s.framework);
  if (s.styling) push("s", s.styling);
  if (s.packageManager !== def.packageManager) push("pm", s.packageManager);
  const tg = s.toggles as Bag;
  if (tg["eslint-prettier"] === false) out.push("tg:no-eslint");
  if (tg.husky === true) out.push("tg:husky");
  if (tg.structure === false) out.push("tg:no-structure");
  const addons = s.addons as unknown as Bag;
  for (const [code, field] of Object.entries(ROUTE_CODES)) {
    if (["p", "t", "n", "l", "f", "s", "pm"].includes(code)) continue;
    const v = addons[field as string];
    if (typeof v === "string" && v) push(code, v);
  }
  return out.join("+");
}

export function decodeRoute(combo: string | null): WizardSelections | null {
  if (!combo) return null;
  try {
    const base = defaultSelections();
    const merged: WizardSelections = {
      ...base,
      toggles: { ...base.toggles },
      addons: { ...base.addons },
    };
    const m = merged as unknown as Bag;
    const mt = m.toggles as Bag;
    const ma = m.addons as Bag;
    let seen = 0;
    for (const raw of combo.split("+")) {
      let token: string;
      try {
        token = decodeURIComponent(raw);
      } catch {
        continue;
      }
      const i = token.indexOf(":");
      if (i < 0) continue;
      const code = token.slice(0, i);
      const value = token.slice(i + 1);
      if (!value) continue;
      if (code === "tg") {
        if (value === "husky") { mt.husky = true; seen++; }
        else if (value === "no-eslint") { mt["eslint-prettier"] = false; seen++; }
        else if (value === "no-structure") { mt.structure = false; seen++; }
        continue;
      }
      const field = ROUTE_CODES[code];
      if (!field) continue;
      if (field === "platform" && value !== "mobile" && value !== "desktop" && value !== "web") continue;
      // Core answers live top-level; addon answers live inside addons.
      if (["backend", "database", "orm", "auth", "payments", "testing", "cicd", "ai", "skills"].includes(field)) {
        ma[field] = value;
      } else {
        (m as Bag)[field] = value;
      }
      seen++;
    }
    if (!seen) return null;
    // Reuse the same normalization as legacy links (blanks, "none", appName).
    return decodeSelections(encodeSelections(merged)) ?? merged;
  } catch {
    return null;
  }
}

export function decodeSelections(raw: string | null): WizardSelections | null {
  if (!raw) return null;
  try {
    const b64 = raw.replaceAll("-", "+").replaceAll("_", "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    // Minimal links only carry picks — everything else falls back to defaults.
    const base = defaultSelections();
    const merged: WizardSelections = {
      ...base,
      ...(parsed as object),
      toggles: { ...base.toggles, ...(asBag((parsed as Bag).toggles) as Record<string, boolean>) },
      addons: { ...base.addons, ...(asBag((parsed as Bag).addons) as Record<string, string>) },
    };
    const p = merged as unknown as Bag;
    // Core answers may be blank (fresh page) — accept strings, default the rest.
    if (typeof p.language !== "string") p.language = "";
    if (typeof p.framework !== "string") p.framework = "";
    if (typeof p.styling !== "string") p.styling = "";
    if (typeof p.packageManager !== "string" || !p.packageManager) p.packageManager = "npm";
    // "none" used to mean skipped — the blank box means the same now, so old
    // links land on blanks instead of "No …" labels. Output is identical.
    const addons = asBag(p.addons);
    for (const [k, v] of Object.entries(addons)) {
      if (v === "none") addons[k] = "";
    }
    p.addons = { ...base.addons, ...addons };
    // Links shared before the mobile/desktop wizards existed have no platform — web it is.
    if (p.platform !== "mobile" && p.platform !== "desktop" && p.platform !== "web") p.platform = "web";
    // Links shared before the app-name field existed have none — the default.
    if (typeof p.appName !== "string" || !p.appName.trim()) p.appName = "my-app";
    else p.appName = p.appName.trim().slice(0, 60);
    return merged;
  } catch {
    return null;
  }
}
