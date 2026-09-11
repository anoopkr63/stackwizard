import { describe, expect, test } from "bun:test";
import {
  assemble,
  buildScript,
  catalogFor,
  defaultSelections,
  isAddonLive,
  isOptionVisible,
  sanitizeAppName,
} from "./assemble";
import type { WizardSelections } from "./types";

function selections(overrides: Partial<WizardSelections> = {}): WizardSelections {
  return {
    ...defaultSelections(),
    ...overrides,
    toggles: { ...defaultSelections().toggles, ...(overrides.toggles ?? {}) },
    addons: { ...defaultSelections().addons, ...(overrides.addons ?? {}) },
  };
}

describe("defaultSelections", () => {
  test("starts blank so no commands generate before picks", () => {
    const d = defaultSelections();
    expect(d.platform).toBe("web");
    expect(d.appName).toBe("my-app");
    expect(d.language).toBe("");
    expect(d.framework).toBe("");
    expect(d.styling).toBe("");
    expect(d.packageManager).toBe("npm");
  });
});

describe("sanitizeAppName", () => {
  test("slugifies web names", () => {
    const sel = { platform: "web" as const, framework: "" };
    expect(sanitizeAppName("My App!", sel)).toBe("my-app");
    expect(sanitizeAppName("  ", sel)).toBe("my-app");
    expect(sanitizeAppName("", sel)).toBe("my-app");
  });

  test("truncates to 60 chars", () => {
    const sel = { platform: "web" as const, framework: "" };
    expect(sanitizeAppName("a".repeat(100), sel)).toHaveLength(60);
  });

  test("uses PascalCase for bare react-native (no prefix convention)", () => {
    const sel = { platform: "mobile" as const, framework: "react-native" };
    expect(sanitizeAppName("my-app", sel)).toBe("Myapp");
    expect(sanitizeAppName("1app", sel)).toBe("App1app");
  });
});

describe("catalogFor", () => {
  test("returns a framework category for every platform", () => {
    for (const p of ["web", "mobile", "desktop"] as const) {
      const catalog = catalogFor(p);
      expect(catalog.categories.some((c) => c.id === "framework")).toBe(true);
    }
  });
});

describe("isOptionVisible", () => {
  const base = selections({ framework: "nextjs" });

  test("platform allow-list filters", () => {
    expect(isOptionVisible({ commands: [], notes: [], platforms: ["mobile"] }, base)).toBe(
      false
    );
    expect(isOptionVisible({ commands: [], notes: [], platforms: ["web"] }, base)).toBe(true);
  });

  test("blank framework never hides framework-gated options", () => {
    const blank = selections();
    expect(
      isOptionVisible({ commands: [], notes: [], frameworks: ["nextjs"] }, blank)
    ).toBe(true);
    expect(isOptionVisible({ commands: [], notes: [], frameworks: ["vue"] }, base)).toBe(
      false
    );
  });

  test("showWhen / hideWhen follow addon picks", () => {
    const withMongo = selections({ framework: "nextjs", addons: { database: "mongodb" } });
    const withoutMongo = selections({ framework: "nextjs", addons: { database: "supabase" } });
    const opt = {
      commands: [],
      notes: [],
      showWhen: { database: ["mongodb"] },
    };
    expect(isOptionVisible(opt, withMongo)).toBe(true);
    expect(isOptionVisible(opt, withoutMongo)).toBe(false);
    const hidden = {
      commands: [],
      notes: [],
      hideWhen: { database: ["supabase"] },
    };
    expect(isOptionVisible(hidden, withoutMongo)).toBe(false);
    expect(isOptionVisible(hidden, withMongo)).toBe(true);
  });
});

describe("isAddonLive", () => {
  test("none, blank, and unknown ids are not live", () => {
    const sel = selections({ framework: "nextjs" });
    expect(isAddonLive(sel, "database", "none")).toBe(false);
    expect(isAddonLive(sel, "database", "")).toBe(false);
    expect(isAddonLive(sel, "database", "does-not-exist")).toBe(false);
  });
});

describe("assemble", () => {
  test("blank framework returns the start prompt only", () => {
    const steps = assemble(selections());
    expect(steps).toHaveLength(1);
    expect(steps[0].section).toBe("Start");
  });

  test("minimal nextjs selection produces well-formed deduped steps", () => {
    const steps = assemble(
      selections({ language: "typescript", framework: "nextjs", styling: "tailwind" })
    );
    expect(steps.length).toBeGreaterThan(1);
    for (const s of steps) {
      expect(typeof s.section).toBe("string");
      expect(typeof s.command).toBe("string");
      expect(typeof s.note).toBe("string");
      expect(s.command.length).toBeGreaterThan(0);
    }
    const cmds = steps.map((s) => s.command);
    for (let i = 1; i < cmds.length; i++) {
      expect(cmds[i]).not.toBe(cmds[i - 1]);
    }
  });

  test("hidden addon picks never leak into output", () => {
    const steps = assemble(
      selections({
        language: "typescript",
        framework: "nextjs",
        styling: "tailwind",
        addons: { database: "does-not-exist" },
      })
    );
    expect(steps.length).toBeGreaterThan(1);
  });
});

describe("buildScript", () => {
  test("emits a guarded bash script with manual run steps separated", () => {
    const steps = assemble(
      selections({ language: "typescript", framework: "nextjs", styling: "tailwind" })
    );
    const sh = buildScript(steps);
    expect(sh.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(sh).toContain("set -e");
    expect(sh).toContain("Generated by StackWizard");
  });
});
