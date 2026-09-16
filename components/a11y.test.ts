import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Defects 26, 28-31 are markup facts. They have no runtime to assert against
// without a DOM renderer (and the contract forbids adding one), so these read
// the shipped source. Rendered-output proof is the curl/grep step in the plan.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

// Class names are assembled at runtime so Tailwind's source scanner cannot
// see them here and resurrect the very utilities these tests forbid.
const cls = (...parts: string[]) => parts.join("");

describe("defect 18 — no hardcoded package-manager commands in the copy", () => {
  test("Guide runs the generator's dev command", () => {
    const guide = read("./Guide.tsx");
    expect(guide).not.toContain('"npm run dev"');
    expect(guide).toContain("devCommand(");
  });
  test("Hero builds its terminal card from assemble()", () => {
    const hero = read("./Hero.tsx");
    expect(hero).not.toContain("npm create next-app");
    expect(hero).toContain("assemble(src)");
  });
  test("nothing still claims the address bar holds the selections", () => {
    expect(read("./Guide.tsx")).not.toContain("the address then holds your exact");
    expect(read("./Faq.tsx")).not.toContain("the address holds that exact setup");
  });
});

describe("defect 26 — per-step Copy buttons are not hover-only", () => {
  const wizard = read("./Wizard.tsx");
  test("no opacity-0 / group-hover reveal on the step Copy button", () => {
    expect(wizard).not.toContain(cls("group-hover:", "opacity-100"));
    expect(wizard).not.toContain(cls("opacity-0 ", "transition-opacity"));
  });
  test("copy is described as a button, not a hover", () => {
    expect(wizard).not.toContain("hover any step to copy");
  });
});

describe("defect 28 — no white text on the light ember token", () => {
  for (const f of ["./Hero.tsx", "./Nav.tsx", "./Footer.tsx", "./Wizard.tsx"]) {
    test(`${f} uses bg-ember-deep for white-on-ember surfaces`, () => {
      const src = read(f);
      // bg-ember/15 blurs and the bg-ember bullet dot carry no text. Only a
      // solid ember fill under white text is the 3.75:1 failure. Both quoted
      // and template-literal className values are scanned.
      const bad = [...src.matchAll(/class[nN]ame=\{?[`"]([^`"]*)/g)]
        .map((m) => m[1])
        .filter((c) => /bg-ember(?![-/\w])/.test(c) && c.includes(cls("text-", "white")));
      expect(bad).toEqual([]);
    });
  }
  test("placeholders no longer fade the muted token", () => {
    expect(read("./Wizard.tsx")).not.toContain(cls("placeholder:", "text-muted/", "60"));
  });
  test("white/40 on night-soft is gone", () => {
    expect(read("./Wizard.tsx")).not.toContain(cls("text-white/", "40"));
  });
  test("the footer email input has a focus indicator instead of outline-none", () => {
    const footer = read("./Footer.tsx");
    expect(footer).not.toContain(cls("focus:", "outline-none"));
    expect(footer).toContain(cls("focus-visible:", "outline-2"));
  });
});

describe("defect 29 — BackToTop is not focusable while hidden", () => {
  const src = read("./BackToTop.tsx");
  test("tabIndex follows visibility", () => {
    expect(src).toContain("tabIndex={show ? 0 : -1}");
  });
  test("and so does the a11y tree", () => {
    expect(src).toContain("aria-hidden={!show}");
  });
});

describe("defect 30 — aria-live is a status message, not the command list", () => {
  const src = read("./Wizard.tsx");
  test("the scrolling list is no longer a live region", () => {
    expect(src).not.toContain('aria-live="polite"');
  });
  test("a single polite status carries the announcement", () => {
    expect(src).toContain('<p role="status" className="sr-only">');
  });
});

describe("defect 31 — <ol> contains only <li>", () => {
  const src = read("./HowItWorks.tsx");
  test("Reveal moved inside the list item", () => {
    const ol = src.slice(src.indexOf("<ol"), src.indexOf("</ol>"));
    expect(ol.indexOf("<li")).toBeLessThan(ol.indexOf("<Reveal"));
  });
});
