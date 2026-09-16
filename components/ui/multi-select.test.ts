import { describe, expect, test } from "bun:test";
import { nextRovingIndex } from "@/components/ui/multi-select";

// Defect 27. The panel itself needs a DOM; the keyboard contract does not, so
// the roving-focus rule is unit-tested here and the markup is checked by the
// curl/grep step in the plan.
describe("nextRovingIndex", () => {
  test("ArrowDown walks forward and wraps", () => {
    expect(nextRovingIndex("ArrowDown", 0, 4)).toBe(1);
    expect(nextRovingIndex("ArrowDown", 3, 4)).toBe(0);
  });

  test("ArrowUp walks back and wraps", () => {
    expect(nextRovingIndex("ArrowUp", 2, 4)).toBe(1);
    expect(nextRovingIndex("ArrowUp", 0, 4)).toBe(3);
  });

  test("Home and End jump to the ends", () => {
    expect(nextRovingIndex("Home", 2, 4)).toBe(0);
    expect(nextRovingIndex("End", 2, 4)).toBe(3);
  });

  test("with focus outside the boxes, Down enters at the top and Up at the bottom", () => {
    expect(nextRovingIndex("ArrowDown", -1, 4)).toBe(0);
    expect(nextRovingIndex("ArrowUp", -1, 4)).toBe(3);
  });

  test("keys the component must not swallow return null", () => {
    for (const k of ["Tab", "Escape", " ", "Enter", "a", "PageDown"]) {
      expect(nextRovingIndex(k, 0, 4)).toBeNull();
    }
  });

  test("an empty list never produces an index", () => {
    expect(nextRovingIndex("ArrowDown", -1, 0)).toBeNull();
    expect(nextRovingIndex("Home", -1, 0)).toBeNull();
  });
});
