// Every wizard edit goes through here. One rule: apply the change, then hand
// the result to normalizeSelections, so an invalid or no-longer-visible pick
// can never sit in state — and therefore never reaches "Still needs code",
// the generated commands, or a share link.
import { normalizeSelections } from "./selections";
import type { PlatformId, WizardSelections } from "./types";

export function setField<K extends keyof WizardSelections>(
  sel: WizardSelections,
  key: K,
  value: WizardSelections[K]
): WizardSelections {
  return normalizeSelections({ ...sel, [key]: value });
}

export function setAddon(sel: WizardSelections, groupId: string, value: string): WizardSelections {
  return normalizeSelections({ ...sel, addons: { ...sel.addons, [groupId]: value } });
}

export function setToggle(sel: WizardSelections, toggleId: string, value: boolean): WizardSelections {
  return normalizeSelections({ ...sel, toggles: { ...sel.toggles, [toggleId]: value } });
}

/** Multi-value groups (AI skills) are stored comma-separated so share links
 *  stay plain strings. An empty list means nothing picked. */
export function setMultiAddon(sel: WizardSelections, groupId: string, ids: string[]): WizardSelections {
  return setAddon(sel, groupId, ids.filter(Boolean).join(","));
}

/** Fresh platform, fresh rules. Re-clicking the platform you are already on is
 *  a no-op: it used to blank language/framework/styling and wipe every pick. */
export function switchPlatform(sel: WizardSelections, platform: PlatformId): WizardSelections {
  if (sel.platform === platform) return sel;
  return normalizeSelections({
    ...sel,
    platform,
    language: "",
    framework: "",
    styling: "",
    addons: { ...sel.addons },
  });
}

/**
 * Share links are built on demand (the Copy share link button), so the address
 * bar stays clean while answering. A page opened on `/s/<combo>` or a legacy
 * `?s=<blob>` has to drop that link on the first edit, or the URL describes a
 * stack the user has already changed.
 *
 * Returns the path to replaceState to, or null when the address is already
 * share-free. Pure, so it unit-tests without a DOM.
 */
export function shareFreeUrl(pathname: string, search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  if (pathname === "/" && !params.has("s")) return null;
  params.delete("s");
  const qs = params.toString();
  return `/${qs ? `?${qs}` : ""}${hash}`;
}

/** Browser wrapper for shareFreeUrl. No-op during SSR. */
export function clearShareUrl(): void {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  const next = shareFreeUrl(pathname, search, hash);
  if (next) window.history.replaceState(null, "", next);
}
