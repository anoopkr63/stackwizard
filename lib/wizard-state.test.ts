import { describe, expect, test } from "bun:test";
import { defaultSelections } from "@/lib/assemble";
import {
  setAddon,
  setField,
  setMultiAddon,
  setToggle,
  shareFreeUrl,
  switchPlatform,
} from "@/lib/wizard-state";
import type { WizardSelections } from "@/lib/types";

const base = (over: Partial<WizardSelections> = {}): WizardSelections => ({
  ...defaultSelections(),
  ...over,
});

describe("switchPlatform (defect 17a)", () => {
  test("re-clicking the active platform keeps every pick", () => {
    const sel = base({
      platform: "web",
      language: "typescript",
      framework: "nextjs",
      styling: "tailwind",
      addons: { ...defaultSelections().addons, database: "supabase", auth: "supabase-auth" },
    });
    const next = switchPlatform(sel, "web");
    expect(next).toBe(sel);
    expect(next.framework).toBe("nextjs");
    expect(next.styling).toBe("tailwind");
    expect(next.addons.auth).toBe("supabase-auth");
  });

  test("a real switch clears core picks the new platform cannot offer", () => {
    const sel = base({ framework: "nextjs", styling: "tailwind", language: "typescript" });
    const next = switchPlatform(sel, "mobile");
    expect(next.platform).toBe("mobile");
    expect(next.framework).toBe("");
    expect(next.styling).toBe("");
  });

  test("web-only addons are dropped on the way to mobile (defect 17c)", () => {
    const sel = base({
      framework: "nextjs",
      addons: { ...defaultSelections().addons, auth: "nextauth" },
    });
    expect(switchPlatform(sel, "mobile").addons.auth).toBe("");
  });

  test("platform-agnostic addons survive the switch", () => {
    const sel = base({ addons: { ...defaultSelections().addons, cicd: "github-actions" } });
    expect(switchPlatform(sel, "desktop").addons.cicd).toBe("github-actions");
  });
});

describe("multi-value skills (defect 17b)", () => {
  const picks = "tdd,code-review,mcp-builder";

  test("survive a platform switch instead of being blanked as one unknown id", () => {
    const sel = base({ addons: { ...defaultSelections().addons, skills: picks } });
    expect(switchPlatform(sel, "mobile").addons.skills).toBe(picks);
  });

  test("survive a framework change", () => {
    const sel = base({ framework: "nextjs", addons: { ...defaultSelections().addons, skills: picks } });
    expect(setField(sel, "framework", "sveltekit").addons.skills).toBe(picks);
  });

  test("setMultiAddon stores a comma-separated string and drops blanks", () => {
    const sel = setMultiAddon(base(), "skills", ["tdd", "", "code-review"]);
    expect(sel.addons.skills).toBe("tdd,code-review");
  });

  test("setMultiAddon with an empty list clears the group", () => {
    const sel = setMultiAddon(base({ addons: { ...defaultSelections().addons, skills: picks } }), "skills", []);
    expect(sel.addons.skills).toBe("");
  });

  test("an unknown id inside the list is filtered, the rest kept", () => {
    const sel = setMultiAddon(base(), "skills", ["tdd", "__proto__", "not-a-skill", "code-review"]);
    expect(sel.addons.skills).toBe("tdd,code-review");
  });
});

describe("setField / setAddon prune hidden picks (defect 17c)", () => {
  test("changing framework drops a framework-scoped addon", () => {
    const sel = base({ framework: "nextjs", addons: { ...defaultSelections().addons, auth: "nextauth" } });
    expect(setField(sel, "framework", "sveltekit").addons.auth).toBe("");
  });

  test("moving the database away from MongoDB drops Mongoose", () => {
    const sel = base({ addons: { ...defaultSelections().addons, database: "mongodb", orm: "mongoose" } });
    expect(setAddon(sel, "database", "postgres").addons.orm).toBe("");
  });

  test("a database with no ORM step clears the ORM group entirely", () => {
    const sel = base({ addons: { ...defaultSelections().addons, database: "postgres", orm: "prisma" } });
    expect(setAddon(sel, "database", "supabase").addons.orm).toBe("");
  });

  test("toggles stay booleans", () => {
    const sel = setToggle(base(), "husky", true);
    expect(sel.toggles.husky).toBe(true);
    expect(setToggle(sel, "husky", false).toggles.husky).toBe(false);
  });

  test("app name is passed through untouched so typing is not fought", () => {
    expect(setField(base(), "appName", "My New ").appName).toBe("My New ");
  });
});

describe("shareFreeUrl (defect 17d)", () => {
  test("a short share route drops to /", () => {
    expect(shareFreeUrl("/s/w-nextjs-tw", "", "")).toBe("/");
  });

  test("a legacy ?s= blob is stripped", () => {
    expect(shareFreeUrl("/", "?s=eyJhIjoxfQ", "")).toBe("/");
  });

  test("a clean address is left alone", () => {
    expect(shareFreeUrl("/", "", "")).toBeNull();
    expect(shareFreeUrl("/", "", "#build")).toBeNull();
  });

  test("the anchor the user is reading is preserved", () => {
    expect(shareFreeUrl("/s/w-nextjs-tw", "", "#build")).toBe("/#build");
  });

  test("unrelated query params survive", () => {
    expect(shareFreeUrl("/", "?s=abc&utm_source=x", "")).toBe("/?utm_source=x");
  });
});
