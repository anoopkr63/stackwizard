import type { WizardSelections } from "./types";

// Encode selections into shareable query params: ?s=<base64url json>
export function encodeSelections(s: WizardSelections): string {
  const json = JSON.stringify(s);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function decodeSelections(raw: string | null): WizardSelections | null {
  if (!raw) return null;
  try {
    const b64 = raw.replaceAll("-", "+").replaceAll("_", "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    // Core answers may be blank (fresh page) — accept strings, default the rest.
    if (typeof parsed.language !== "string") parsed.language = "";
    if (typeof parsed.framework !== "string") parsed.framework = "";
    if (typeof parsed.styling !== "string") parsed.styling = "";
    if (typeof parsed.packageManager !== "string" || !parsed.packageManager) parsed.packageManager = "npm";
    // "none" used to mean skipped — the blank box means the same now, so old
    // links land on blanks instead of "No …" labels. Output is identical.
    if (parsed.addons && typeof parsed.addons === "object") {
      for (const [k, v] of Object.entries(parsed.addons)) {
        if (v === "none") (parsed.addons as Record<string, string>)[k] = "";
      }
    }
    // Links shared before the mobile/desktop wizards existed have no platform — web it is.
    if (parsed.platform !== "mobile" && parsed.platform !== "desktop" && parsed.platform !== "web") parsed.platform = "web";
    // Links shared before the app-name field existed have none — the default.
    if (typeof parsed.appName !== "string" || !parsed.appName.trim()) parsed.appName = "my-app";
    else parsed.appName = parsed.appName.trim().slice(0, 60);
    return parsed as WizardSelections;
  } catch {
    return null;
  }
}
