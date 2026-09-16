import type { PackageManagerId, PlatformId, WizardSelections } from "./types";
import web from "@/data/web.json";
import mobile from "@/data/mobile.json";
import desktop from "@/data/desktop.json";
import addons from "@/data/addons.json";

export function catalogFor(platform: PlatformId) {
  if (platform === "mobile") return mobile;
  if (platform === "desktop") return desktop;
  return web;
}

// Minimal shape the visibility/command helpers need — deliberately wider than
// StackOption so JSON-imported options (inferred `string[]`) stay assignable.
export interface OptionLike {
  platforms?: string[];
  frameworks?: string[];
  overrides?: { [k: string]: { commands: string[]; notes: string[] } | undefined };
  showWhen?: Record<string, string[]>;
  hideWhen?: Record<string, string[]>;
  commands: string[];
  notes: string[];
  commandsMobile?: string[];
  notesMobile?: string[];
  commandsDesktop?: string[];
  notesDesktop?: string[];
}

// An option is visible only on its listed platforms (when set) and only when
// its allow-list (showWhen) matches and its deny-list (hideWhen) doesn't —
// e.g. Stripe's package differs per platform, Mongoose needs MongoDB.
// Used by the UI and the generator so hidden picks can never leak into the
// output (stale share links included).
export function isOptionVisible(opt: OptionLike, selections: WizardSelections): boolean {
  if (opt.platforms && !opt.platforms.includes(selections.platform ?? "web")) return false;
  // Blank framework (nothing picked yet) counts as visible — never hide
  // options before the user has chosen.
  if (opt.frameworks && selections.framework && !opt.frameworks.includes(selections.framework)) return false;
  for (const [groupId, allowed] of Object.entries(opt.showWhen ?? {})) {
    if (!allowed.includes(selections.addons[groupId] ?? "none")) return false;
  }
  for (const [groupId, denied] of Object.entries(opt.hideWhen ?? {})) {
    if (denied.includes(selections.addons[groupId] ?? "none")) return false;
  }
  return true;
}

export function defaultSelections(): WizardSelections {
  return {
    platform: "web",
    target: "android",
    appName: "my-app",
    language: "",
    framework: "",
    styling: "",
    packageManager: "npm",
    toggles: { "eslint-prettier": true, husky: false, structure: true },
    addons: {
      backend: "",
      database: "",
      orm: "",
      auth: "",
      payments: "",
      graphics: "",
      testing: "",
      cicd: "",
      ai: "",
      skills: "",
    },
  };
}

// ---- normalizeSelections ---------------------------------------------------
// Single source of truth for "valid + visible pick". Every entry point that
// accepts selections from outside the wizard (share links, presets, saved
// state) runs them through here, so a value that is not in data/*.json — or
// is in the data but hidden for the current platform/framework/addon combo —
// can never reach the generator. Pure and idempotent.

type Bag = Record<string, unknown>;

/** Option lists in the JSON carry an id; the visibility helper doesn't need it. */
type IdOption = OptionLike & { id: string };

type CatalogShape = { categories: { id: string; options: IdOption[] }[] };
type GroupShape = {
  id: string;
  options?: IdOption[];
  toggles?: { id: string }[];
  dependsOn?: string;
  showWhenNot?: string[];
};

const ADDON_GROUPS = addons.groups as unknown as GroupShape[];

const PLATFORMS: PlatformId[] = ["web", "mobile", "desktop"];
const PACKAGE_MANAGERS: PackageManagerId[] = ["npm", "yarn", "pnpm", "bun"];
const LANGUAGES = ["typescript", "javascript"];
const TARGETS: ("android" | "ios")[] = ["android", "ios"];

/** appName is sanitized at use (sanitizeAppName); this only caps abuse. */
const MAX_APP_NAME = 64;
/** Clearing one pick can orphan another — settle in a few passes. */
const MAX_PASSES = 5;

/** Toggle ids that actually exist in data/addons.json. */
const TOGGLE_IDS: string[] = ADDON_GROUPS.flatMap((g) => (g.toggles ?? []).map((t) => t.id));

function catalogOptions(platform: PlatformId, categoryId: string): IdOption[] {
  const catalog = catalogFor(platform) as unknown as CatalogShape;
  return catalog.categories.find((c) => c.id === categoryId)?.options ?? [];
}

/** A whole group can be hidden by its own rule (orm needs a real database). */
function isGroupVisible(group: GroupShape, sel: WizardSelections): boolean {
  if (!group.dependsOn || !group.showWhenNot) return true;
  return !group.showWhenNot.includes(sel.addons[group.dependsOn] || "none");
}

function pickOne(options: IdOption[], value: unknown, sel: WizardSelections): string {
  if (typeof value !== "string" || !value) return "";
  const opt = options.find((o) => o.id === value);
  if (!opt || !isOptionVisible(opt, sel)) return "";
  return value;
}

/** `skills` stores several ids as one comma-separated string. */
function pickMany(options: IdOption[], value: unknown, sel: WizardSelections): string {
  if (typeof value !== "string" || !value) return "";
  const kept: string[] = [];
  for (const raw of value.split(",")) {
    const id = raw.trim();
    if (!id || kept.includes(id)) continue;
    const opt = options.find((o) => o.id === id);
    if (!opt || !isOptionVisible(opt, sel)) continue;
    kept.push(id);
  }
  return kept.join(",");
}

export function normalizeSelections(input: WizardSelections): WizardSelections {
  const def = defaultSelections();
  const raw = (input ?? {}) as unknown as Bag;

  const platform = PLATFORMS.includes(raw.platform as PlatformId)
    ? (raw.platform as PlatformId)
    : def.platform;
  const target = TARGETS.includes(raw.target as "android" | "ios")
    ? (raw.target as "android" | "ios")
    : def.target;
  const packageManager = PACKAGE_MANAGERS.includes(raw.packageManager as PackageManagerId)
    ? (raw.packageManager as PackageManagerId)
    : def.packageManager;
  // Blank is a real state (nothing picked yet) — anything else must be known.
  const language =
    typeof raw.language === "string" && LANGUAGES.includes(raw.language) ? raw.language : "";
  const appName =
    typeof raw.appName === "string" ? raw.appName.slice(0, MAX_APP_NAME) : def.appName;

  // Only ids that exist in the data, only booleans, everything else defaulted.
  const rawToggles = (raw.toggles ?? {}) as Bag;
  const toggles: Record<string, boolean> = {};
  for (const id of TOGGLE_IDS) {
    const v = rawToggles[id];
    toggles[id] = typeof v === "boolean" ? v : (def.toggles[id] ?? false);
  }

  const out: WizardSelections = {
    ...def,
    platform,
    target,
    packageManager,
    language,
    appName,
    framework: "",
    styling: "",
    toggles,
    addons: { ...def.addons },
  };

  // Core picks depend on the platform, so they settle before the addons do.
  const rawFramework = (raw as Bag).framework;
  const rawStyling = (raw as Bag).styling;
  out.framework = pickOne(catalogOptions(platform, "framework"), rawFramework, out);
  out.styling = pickOne(catalogOptions(platform, "styling"), rawStyling, out);

  // Seed every known addon group from the input, then prune until stable:
  // visibility is cross-referential (mongoose needs mongodb, auth0 needs a
  // framework), so one removal can invalidate another pick.
  const rawAddons = (raw.addons ?? {}) as Bag;
  for (const group of ADDON_GROUPS) {
    if (!group.options) continue;
    const v = rawAddons[group.id];
    out.addons[group.id] = typeof v === "string" ? v : "";
  }
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    for (const group of ADDON_GROUPS) {
      if (!group.options) continue;
      const before = out.addons[group.id] ?? "";
      const after = !isGroupVisible(group, out)
        ? ""
        : group.id === "skills"
          ? pickMany(group.options, before, out)
          : pickOne(group.options, before, out);
      if (after !== before) {
        out.addons[group.id] = after;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return out;
}
