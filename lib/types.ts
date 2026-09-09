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
  /** Per-platform command/note overrides (used on mobile when present). */
  commandsMobile?: string[];
  notesMobile?: string[];
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
export type PlatformId = "web" | "mobile";

export interface WizardSelections {
  platform: PlatformId;
  language: LanguageId;
  framework: string;
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
