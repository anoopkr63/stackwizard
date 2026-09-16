import { afterEach, describe, expect, test } from "bun:test";
import { copyText } from "@/lib/clipboard";

type Stub = { restore: () => void };

function stubGlobals(parts: Record<string, unknown>): Stub {
  const had = Object.keys(parts).map((k) => [k, k in globalThis, (globalThis as never)[k]] as const);
  for (const [k, v] of Object.entries(parts)) {
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
  return {
    restore() {
      for (const [k, existed, v] of had) {
        if (existed) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
        else delete (globalThis as never)[k];
      }
    },
  };
}

function fakeDocument(execResult: boolean | (() => boolean)) {
  const created: { value: string; removed: boolean }[] = [];
  return {
    doc: {
      createElement() {
        const el = {
          value: "",
          removed: false,
          style: {} as Record<string, string>,
          setAttribute() {},
          select() {},
          setSelectionRange() {},
          remove() {
            el.removed = true;
          },
        };
        created.push(el);
        return el;
      },
      body: { appendChild() {} },
      execCommand: () => (typeof execResult === "function" ? execResult() : execResult),
    },
    created,
  };
}

let active: Stub | null = null;
afterEach(() => {
  active?.restore();
  active = null;
});

describe("copyText (defect 32)", () => {
  test("returns true when the async clipboard accepts the text", async () => {
    let got = "";
    active = stubGlobals({
      navigator: { clipboard: { writeText: async (t: string) => void (got = t) } },
    });
    expect(await copyText("bun create vite my-app")).toBe(true);
    expect(got).toBe("bun create vite my-app");
  });

  test("returns false — not a fake success — when both paths fail", async () => {
    const { doc } = fakeDocument(false);
    active = stubGlobals({
      navigator: { clipboard: { writeText: async () => { throw new Error("NotAllowedError"); } } },
      document: doc,
    });
    expect(await copyText("npm run dev")).toBe(false);
  });

  test("falls back to execCommand and reports its result", async () => {
    const { doc, created } = fakeDocument(true);
    active = stubGlobals({
      navigator: { clipboard: { writeText: async () => { throw new Error("insecure context"); } } },
      document: doc,
    });
    expect(await copyText("cd my-app")).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0].value).toBe("cd my-app");
  });

  test("always removes the scratch textarea, even when execCommand throws", async () => {
    const { doc, created } = fakeDocument(() => {
      throw new Error("execCommand is not a function");
    });
    active = stubGlobals({ navigator: {}, document: doc });
    expect(await copyText("x")).toBe(false);
    expect(created[0].removed).toBe(true);
  });

  test("returns false during SSR (no navigator, no document)", async () => {
    active = stubGlobals({ navigator: undefined, document: undefined });
    expect(await copyText("x")).toBe(false);
  });
});
