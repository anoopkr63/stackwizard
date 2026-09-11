import { describe, expect, test } from "bun:test";
import { defaultSelections } from "./assemble";
import {
  decodeRoute,
  decodeSelections,
  encodeRoute,
  encodeSelections,
} from "./share";
import type { WizardSelections } from "./types";

function selections(overrides: Partial<WizardSelections> = {}): WizardSelections {
  return {
    ...defaultSelections(),
    ...overrides,
    toggles: { ...defaultSelections().toggles, ...(overrides.toggles ?? {}) },
    addons: { ...defaultSelections().addons, ...(overrides.addons ?? {}) },
  };
}

describe("encodeSelections / decodeSelections", () => {
  test("fresh page encodes to empty (no ?s= param)", () => {
    expect(encodeSelections(defaultSelections())).toBe("");
  });

  test("round-trips picks through base64url", () => {
    const sel = selections({
      platform: "web",
      appName: "shop",
      language: "typescript",
      framework: "nextjs",
      styling: "tailwind",
      packageManager: "bun",
      addons: { database: "supabase", auth: "supabase-auth" },
    });
    const raw = encodeSelections(sel);
    expect(raw.length).toBeGreaterThan(0);
    // URL-safe alphabet: no + / or = padding.
    expect(raw).not.toMatch(/[+/=]/);
    const back = decodeSelections(raw);
    expect(back?.framework).toBe("nextjs");
    expect(back?.appName).toBe("shop");
    expect(back?.packageManager).toBe("bun");
    expect(back?.addons.database).toBe("supabase");
    expect(back?.addons.auth).toBe("supabase-auth");
  });

  test("rejects null and garbage", () => {
    expect(decodeSelections(null)).toBeNull();
    expect(decodeSelections("!!!not-base64!!!")).toBeNull();
  });

  test("legacy 'none' addon values normalize to blank", () => {
    const sel = selections({ framework: "nextjs", addons: { database: "none" } });
    const back = decodeSelections(encodeSelections(sel));
    expect(back?.addons.database).toBe("");
  });
});

describe("encodeRoute / decodeRoute", () => {
  test("round-trips short links", () => {
    const sel = selections({
      language: "typescript",
      framework: "nextjs",
      styling: "tailwind",
      addons: { database: "supabase" },
    });
    const route = encodeRoute(sel);
    expect(route).toContain("f:nextjs");
    const back = decodeRoute(route);
    expect(back?.framework).toBe("nextjs");
    expect(back?.language).toBe("typescript");
    expect(back?.addons.database).toBe("supabase");
  });

  test("rejects null and token-less input", () => {
    expect(decodeRoute(null)).toBeNull();
    expect(decodeRoute("garbage-without-colon")).toBeNull();
  });

  test("ignores unknown codes but keeps known ones", () => {
    const back = decodeRoute("zz:nope+f:nextjs");
    expect(back?.framework).toBe("nextjs");
  });
});
