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
    if (!parsed.language || !parsed.framework || !parsed.packageManager) return null;
    // Links shared before the mobile wizard existed have no platform — web it is.
    if (parsed.platform !== "mobile" && parsed.platform !== "web") parsed.platform = "web";
    return parsed as WizardSelections;
  } catch {
    return null;
  }
}
