import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Defect 16 — CSS has no runtime to unit-test, so this asserts the shipped
// rule text. It is a real regression guard: deleting the property fails here.
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function reducedMotionBlock(): string {
  const at = css.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(at).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf("{", at); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(at, i + 1);
  }
  throw new Error("unterminated @media block");
}

describe("prefers-reduced-motion", () => {
  const block = reducedMotionBlock();

  test("caps every animation at one pass so infinite ones cannot strobe", () => {
    expect(block).toContain("animation-iteration-count: 1 !important;");
  });

  test("still collapses durations", () => {
    expect(block).toContain("animation-duration: 0.01ms !important;");
    expect(block).toContain("transition-duration: 0.01ms !important;");
  });

  test("zeroes the stagger delays", () => {
    expect(block).toContain("animation-delay: 0ms !important;");
    expect(block).toContain("transition-delay: 0ms !important;");
  });

  test("never forces animation-fill-mode (.anim-hero needs forwards, twinkle must not freeze)", () => {
    expect(block).not.toContain("animation-fill-mode:");
  });

  test("the infinite animations it has to tame are still in the stylesheet", () => {
    for (const cls of [".anim-blob-warm", ".anim-blob-cool", ".anim-float", ".anim-twinkle", ".marquee-track"]) {
      const at = css.indexOf(cls + " {");
      expect(at).toBeGreaterThan(-1);
      expect(css.slice(at, css.indexOf("}", at))).toContain("infinite");
    }
  });
});
