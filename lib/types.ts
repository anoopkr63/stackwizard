// Shared types for the StackWizard data layer.
// All recipes live in /data/*.json — never hardcode commands in components.

export interface StackOption {
  id: string;
  label: string;
  hint?: string;
  commands: string[];
  notes: string[];
  showWhen?: Record<string, string[]>;
  hideWhen?: Record<string, string[]>;
  /** Platforms this option is offered on. Omitted = all platforms. */
  platforms?: string[];
  /** Frameworks this option is offered on (e.g. NextAuth only on Next.js).
   * Omitted = all frameworks. Blank framework selection counts as visible. */
  frameworks?: string[];
  /** Per-framework command/note overrides, checked before the
   * platform overrides below (Clerk's package differs per framework). */
  overrides?: { [k: string]: { commands: string[]; notes: string[] } | undefined };
  /** Per-platform command/note overrides (used on mobile/desktop when present). */
  commandsMobile?: string[];
  notesMobile?: string[];
  commandsDesktop?: string[];
  notesDesktop?: string[];
}

export interface Category {
  id: string;
  label: string;
  help: string;
  options: StackOption[];
}

export interface Toggle {
  id: string;
  label: string;
  help: string;
  commands: string[];
  notes: string[];
  platforms?: string[];
  frameworks?: string[];
}

export interface AddonGroup {
  id: string;
  label: string;
  help: string;
  options?: StackOption[];
  toggles?: Toggle[];
  dependsOn?: string;
  showWhenNot?: string[];
}

export type PackageManagerId = "npm" | "yarn" | "pnpm" | "bun";
export type LanguageId = "typescript" | "javascript";
export type PlatformId = "web" | "mobile" | "desktop";

export interface WizardSelections {
  platform: PlatformId;
  /** Folder the scaffold creates (sanitized at use — see sanitizeAppName). */
  appName: string;
  /** Mobile only: which phone to ship to first. Always one of the two — never none. */
  target: "android" | "ios";
  /** Blank until picked — the core dropdowns start empty. */
  language: string;
  /** Blank until picked — no commands generate without one. */
  framework: string;
  /** Blank until picked. */
  styling: string;
  packageManager: PackageManagerId;
  toggles: Record<string, boolean>;
  addons: Record<string, string>;
}

export interface BuildStep {
  command: string;
  note: string;
  section: string;
}
