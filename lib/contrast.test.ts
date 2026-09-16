import { describe, expect, test } from "bun:test";

// Defect 28. WCAG 2.1 relative luminance + contrast, computed — never eyeballed.
type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
/** Tailwind's `text-white/70` paints white at 70% alpha over its background. */
const over = (fg: RGB, alpha: number, bg: RGB): RGB =>
  [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha))) as RGB;
const luminance = (c: RGB) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const WHITE = hex("#ffffff");
const BLACK = hex("#000000");
const EMBER = hex("#e8501a");
const EMBER_DEEP = hex("#bc3d0f");
const NIGHT_SOFT = hex("#221a10");
const NIGHT = hex("#171209");
const MUTED = hex("#6f6254");
const AA = 4.5;

describe("the ratios the audit flagged really do fail", () => {
  test("white/70 on ember = 2.55:1", () => {
    expect(contrast(over(WHITE, 0.7, EMBER), EMBER)).toBeCloseTo(2.55, 2);
  });
  test("white on ember = 3.75:1", () => {
    expect(contrast(WHITE, EMBER)).toBeCloseTo(3.75, 2);
  });
  test("muted/60 on white = 2.55:1", () => {
    expect(contrast(over(MUTED, 0.6, WHITE), WHITE)).toBeCloseTo(2.55, 2);
  });
  test("white/40 on night-soft = 3.80:1", () => {
    expect(contrast(over(WHITE, 0.4, NIGHT_SOFT), NIGHT_SOFT)).toBeCloseTo(3.8, 2);
  });
});

describe("the replacements pass WCAG AA for normal text", () => {
  test("white on ember-deep (CTAs, Copy all, Required badge)", () => {
    expect(contrast(WHITE, EMBER_DEEP)).toBeGreaterThanOrEqual(AA);
  });
  test("white on ember-deep at hover:brightness-90", () => {
    const hover = EMBER_DEEP.map((v) => Math.round(v * 0.9)) as RGB;
    expect(contrast(WHITE, hover)).toBeGreaterThanOrEqual(AA);
  });
  test("white footer nav headings on ember-deep", () => {
    expect(contrast(WHITE, EMBER_DEEP)).toBeGreaterThanOrEqual(AA);
  });
  test("white/70 placeholder on the bg-black/20 pill over ember-deep", () => {
    const pill = over(BLACK, 0.2, EMBER_DEEP);
    expect(contrast(over(WHITE, 0.7, pill), pill)).toBeGreaterThanOrEqual(AA);
    expect(contrast(WHITE, pill)).toBeGreaterThanOrEqual(AA);
  });
  test("full muted placeholder on white", () => {
    expect(contrast(MUTED, WHITE)).toBeGreaterThanOrEqual(AA);
  });
  test("white/70 on night-soft (section labels, step Copy, overflow hint)", () => {
    expect(contrast(over(WHITE, 0.7, NIGHT_SOFT), NIGHT_SOFT)).toBeGreaterThanOrEqual(AA);
  });
  test("white/75 on night (command header meta)", () => {
    expect(contrast(over(WHITE, 0.75, NIGHT), NIGHT)).toBeGreaterThanOrEqual(AA);
  });
  test("the white focus outline clears 3:1 against ember-deep", () => {
    expect(contrast(WHITE, EMBER_DEEP)).toBeGreaterThanOrEqual(3);
  });
});
