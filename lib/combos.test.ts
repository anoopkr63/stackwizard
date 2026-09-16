// Regression harness: sweeps every platform × framework × language × package
// manager, plus one pass per add-on option and both structure-toggle states,
// and asserts invariants that must hold for EVERY generated setup. One bad
// combo out of thousands used to be invisible; here it fails a named test.
import { describe, expect, test } from "bun:test";
import { assemble, buildScript, catalogFor, codeGapsFor, defaultSelections, devCommand } from "./assemble";
import addons from "@/data/addons.json";
import type { BuildStep, PackageManagerId, PlatformId, WizardSelections } from "./types";

const PLATFORMS: PlatformId[] = ["web", "mobile", "desktop"];
const PMS: PackageManagerId[] = ["npm", "yarn", "pnpm", "bun"];
const LANGS = ["typescript", "javascript"];

function sel(o: Partial<WizardSelections> = {}): WizardSelections {
  const d = defaultSelections();
  return { ...d, ...o, toggles: { ...d.toggles, ...(o.toggles ?? {}) }, addons: { ...d.addons, ...(o.addons ?? {}) } };
}

export function allCombos(): WizardSelections[] {
  const out: WizardSelections[] = [];
  for (const platform of PLATFORMS) {
    const catalog = catalogFor(platform);
    const frameworks = catalog.categories.find((c) => c.id === "framework")!.options.map((o) => o.id);
    const stylings = catalog.categories.find((c) => c.id === "styling")!.options.map((o) => o.id);
    for (const framework of frameworks) {
      for (const language of LANGS) {
        for (const packageManager of PMS) {
          for (const styling of stylings) {
            out.push(sel({ platform, framework, language, packageManager, styling }));
          }
        }
        for (const group of addons.groups) {
          for (const opt of group.options ?? []) {
            if (opt.id === "none") continue;
            out.push(
              sel({
                platform,
                framework,
                language,
                packageManager: "bun",
                styling: stylings[0],
                addons: { [group.id]: opt.id },
              })
            );
          }
        }
        for (const structure of [true, false]) {
          out.push(
            sel({
              platform,
              framework,
              language,
              packageManager: "bun",
              styling: stylings[0],
              toggles: { structure },
              addons: { auth: "nextauth", payments: "stripe", database: "supabase" },
            })
          );
        }
      }
    }
  }
  return out;
}

const COMBOS = allCombos();
const BUILT: { s: WizardSelections; steps: BuildStep[] }[] = COMBOS.map((s) => ({ s, steps: assemble(s) }));

function fail(s: WizardSelections, why: string): string {
  return `${s.platform}/${s.framework}/${s.language}/${s.packageManager}/${s.styling} ${JSON.stringify(s.addons)} — ${why}`;
}

describe("combo sweep", () => {
  test("covers every framework on every platform", () => {
    expect(COMBOS.length).toBeGreaterThan(1000);
  });

  test("every step has a section, a command and a note field", () => {
    const bad: string[] = [];
    for (const { s, steps } of BUILT) {
      for (const st of steps) {
        if (!st.section || !st.command || typeof st.note !== "string") bad.push(fail(s, `bad step ${JSON.stringify(st)}`));
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  test("section numbers run 1..n with no gaps", () => {
    const bad: string[] = [];
    for (const { s, steps } of BUILT) {
      const seen: number[] = [];
      for (const st of steps) {
        const m = /^(\d+) · /.exec(st.section);
        if (!m) continue;
        const n = Number(m[1]);
        if (seen[seen.length - 1] !== n) seen.push(n);
      }
      const expected = seen.map((_, i) => i + 1);
      if (JSON.stringify(seen) !== JSON.stringify(expected)) bad.push(fail(s, `sections ${seen.join(",")}`));
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  test("no placeholder token survives into a command", () => {
    const bad: string[] = [];
    for (const { s, steps } of BUILT) {
      for (const st of steps) {
        const m = /__[A-Z_]+__|\$\{PUB\}|\$\{[A-Za-z]/.exec(st.command);
        if (m) bad.push(fail(s, `unexpanded ${m[0]} in ${st.command.split("\n")[0]}`));
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  test("the generated setup.sh is valid bash", () => {
    const bad: string[] = [];
    // One script every 37 combos: the bash shape does not vary with add-ons,
    // and `bash -n` costs a process per call.
    for (const { s, steps } of BUILT.filter((_, i) => i % 37 === 0)) {
      const r = Bun.spawnSync(["bash", "-n"], { stdin: Buffer.from(buildScript(steps)), stderr: "pipe" });
      if (r.exitCode !== 0) bad.push(fail(s, new TextDecoder().decode(r.stderr).split("\n")[0]));
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe("exports section C depends on", () => {
  test("devCommand returns a command + note for every platform/framework", () => {
    for (const platform of PLATFORMS) {
      const frameworks = catalogFor(platform).categories.find((c) => c.id === "framework")!.options.map((o) => o.id);
      for (const framework of frameworks) {
        for (const pm of PMS) {
          const d = devCommand(pm, platform, framework, "android");
          expect(typeof d.command).toBe("string");
          expect(d.command.length).toBeGreaterThan(0);
          expect(typeof d.note).toBe("string");
        }
      }
    }
  });

  test("codeGapsFor keeps the richer wizard messages", () => {
    expect(
      codeGapsFor(sel({ framework: "nextjs", styling: "tailwind", language: "typescript", addons: { auth: "clerk" } }), "web")
    ).toEqual(["Login: wrap your layout in <ClerkProvider> + add sign-in buttons."]);
    expect(
      codeGapsFor(sel({ framework: "nextjs", language: "typescript", addons: { auth: "nextauth" } }), "web")
    ).toEqual(["Login: add your OAuth credentials + check the session with auth()."]);
    expect(codeGapsFor(sel(), "web")).toEqual([]);
  });
});

describe("picks that must not leak or vanish", () => {
  test("Next.js auth and webhook routes appear with the folders toggle off", () => {
    for (const structure of [true, false]) {
      const joined = assemble(
        sel({
          framework: "nextjs",
          language: "typescript",
          styling: "tailwind",
          toggles: { structure },
          addons: { auth: "nextauth", payments: "stripe" },
        })
      )
        .map((s) => s.command)
        .join("\n");
      expect(joined).toContain("src/app/api/auth/[...nextauth]/route.ts");
      expect(joined).toContain("src/app/api/webhooks/stripe/route.ts");
    }
  });

  test("a payments pick hidden on mobile leaves no trace", () => {
    const all = assemble(
      sel({ platform: "mobile", framework: "expo", language: "typescript", styling: "stylesheet", addons: { payments: "paddle" } })
    )
      .map((s) => s.command)
      .join("\n");
    expect(all.toLowerCase()).not.toContain("paddle");
  });

  test("Electron is never offered React-only tooling", () => {
    const joined = assemble(
      sel({
        platform: "desktop",
        framework: "electron",
        language: "typescript",
        styling: "tailwind",
        packageManager: "bun",
        addons: { graphics: "fiber" },
      })
    )
      .map((s) => s.command)
      .join("\n");
    expect(joined).not.toContain("eslint-plugin-react");
    expect(joined).not.toContain("@react-three/fiber");
  });

  test("an ORM pick with no database installs nothing", () => {
    const all = assemble(
      sel({ framework: "nextjs", language: "typescript", styling: "tailwind", addons: { orm: "prisma" } })
    )
      .map((s) => s.command)
      .join("\n");
    expect(all).not.toContain("prisma");
  });
});

describe("scaffold commands the CLIs actually accept", () => {
  test("bun scaffolds carry no `--` separator bunx will not consume", () => {
    for (const framework of ["vue", "react-vite", "solid"]) {
      for (const language of LANGS) {
        const first = assemble(sel({ framework, language, styling: "tailwind", packageManager: "bun" }))[0].command;
        expect(first).not.toContain(" -- ");
      }
    }
  });

  test("bun gets the real template flags", () => {
    expect(
      assemble(sel({ framework: "react-vite", language: "typescript", styling: "tailwind", packageManager: "bun" }))[0].command
    ).toBe("bunx create-vite@latest my-app --template react-ts");
    expect(
      assemble(sel({ framework: "solid", language: "javascript", styling: "tailwind", packageManager: "bun" }))[0].command
    ).toBe("bunx create-vite@latest my-app --template solid");
    expect(
      assemble(sel({ framework: "vue", language: "typescript", styling: "tailwind", packageManager: "bun" }))[0].command
    ).toBe("bunx create-vue@latest --ts my-app");
  });

  test("sv create never gets an invalid --types value", () => {
    for (const language of LANGS) {
      const cmd = assemble(sel({ framework: "sveltekit", language, styling: "tailwind", packageManager: "bun" }))[0].command;
      expect(cmd).not.toContain("--types no-types");
      expect(cmd).toContain(language === "typescript" ? "--types ts" : "--no-types");
    }
  });

  test("Electron uses a template Forge actually ships", () => {
    expect(
      assemble(sel({ platform: "desktop", framework: "electron", language: "javascript", styling: "tailwind", packageManager: "bun" }))[0].command
    ).toBe("bunx create-electron-app@latest my-app --template=vite");
    expect(
      assemble(sel({ platform: "desktop", framework: "electron", language: "typescript", styling: "tailwind", packageManager: "bun" }))[0].command
    ).toBe("bunx create-electron-app@latest my-app --template=vite-typescript");
  });

  test("npm keeps the separator it does consume", () => {
    expect(
      assemble(sel({ framework: "react-vite", language: "typescript", styling: "tailwind", packageManager: "npm" }))[0].command
    ).toBe("npm create vite@latest my-app -- --template react-ts");
    expect(
      assemble(sel({ framework: "vue", language: "typescript", styling: "tailwind", packageManager: "npm" }))[0].command
    ).toBe("npm create vue@latest -- --ts my-app");
  });
});

describe("generated app code", () => {
  test("no stub reads env through a computed key", () => {
    const bad: string[] = [];
    for (const { s, steps } of BUILT) {
      for (const st of steps) {
        if (/process\.env\[|import\.meta\.env\[|\benv\[name\]/.test(st.command)) bad.push(fail(s, st.command.split("\n")[0]));
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  test("Cursor rules land where Cursor reads them, with .mdc frontmatter", () => {
    const cmds = assemble(
      sel({ framework: "nextjs", language: "typescript", styling: "tailwind", addons: { ai: "cursor" } })
    ).map((s) => s.command);
    expect(cmds.join("\n")).not.toContain(".muserules");
    expect(cmds).toContain("mkdir -p .cursor/rules");
    const rules = cmds.find((c) => c.includes(".cursor/rules/stackwizard.mdc"))!;
    expect(rules.split("\n")[1]).toBe("---");
    expect(rules).toContain("alwaysApply: true");
  });

  test("Angular + Tailwind writes config Angular reads, under the names it generates", () => {
    const joined = assemble(
      sel({ framework: "angular", language: "typescript", styling: "tailwind", packageManager: "bun" })
    )
      .map((s) => s.command)
      .join("\n");
    expect(joined).toContain("cat > .postcssrc.json");
    expect(joined).not.toContain("postcss.config.js");
    expect(joined).toContain("cat > src/app/app.ts");
    expect(joined).toContain("cat > src/app/app.spec.ts");
    expect(joined).toContain("rm -f src/app/app.html src/app/app.css");
    expect(joined).not.toContain("app.component");
  });

  test("Auth.js installs the version whose API the config uses, under its real module name", () => {
    const all = assemble(
      sel({ framework: "nextjs", language: "typescript", styling: "tailwind", addons: { auth: "nextauth" } })
    )
      .map((s) => s.command)
      .join("\n");
    expect(all).toContain("next-auth@beta");
    expect(all).toContain('from "next-auth/providers/github"');
    expect(all).not.toContain("providers/GitHub");
  });

  test("Auth0 on Next.js lists the v4 keys the SDK reads", () => {
    const env = assemble(
      sel({ framework: "nextjs", language: "typescript", styling: "tailwind", addons: { auth: "auth0" } })
    ).find((s) => s.command.includes(".env.local.example"))!.command;
    for (const k of ["AUTH0_DOMAIN=", "AUTH0_CLIENT_ID=", "AUTH0_CLIENT_SECRET=", "AUTH0_SECRET=", "APP_BASE_URL="]) {
      expect(env).toContain(k);
    }
    expect(env).not.toContain("AUTH0_ISSUER_BASE_URL");
    expect(env).not.toContain("AUTH0_BASE_URL=");
  });

  test("the Paddle stub reads the prefixed key the env file documents", () => {
    const steps = assemble(
      sel({ framework: "react-vite", language: "typescript", styling: "tailwind", addons: { payments: "paddle" } })
    );
    const stub = steps.find((s) => s.command.includes("lib/paddle.ts"))!.command;
    expect(stub).toContain('required("VITE_PADDLE_ENVIRONMENT", import.meta.env.VITE_PADDLE_ENVIRONMENT)');
    expect(steps.find((s) => s.command.includes(".env.example"))!.command).toContain("VITE_PADDLE_ENVIRONMENT=");
  });

  test("RevenueCat keys carry the prefix Expo needs to inline them", () => {
    const steps = assemble(
      sel({ platform: "mobile", framework: "expo", language: "typescript", styling: "stylesheet", addons: { payments: "revenuecat" } })
    );
    const stub = steps.find((s) => s.command.includes("lib/purchases.ts"))!.command;
    expect(stub).toContain("process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY");
    expect(steps.find((s) => s.command.includes(".env.example"))!.command).toContain("EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=");
  });
});

describe("package manager honesty", () => {
  test("no command hardcodes npx when another manager was picked", () => {
    const bad: string[] = [];
    for (const { s, steps } of BUILT) {
      if (s.packageManager === "npm") continue;
      for (const st of steps) if (/(^|\s)npx\s/.test(st.command)) bad.push(fail(s, st.command.split("\n")[0]));
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  test("every Wails dependency command runs inside frontend/", () => {
    const steps = assemble(
      sel({
        platform: "desktop",
        framework: "wails",
        language: "typescript",
        styling: "tailwind",
        packageManager: "bun",
        addons: { database: "supabase", graphics: "three", testing: "vitest" },
      })
    );
    expect(steps.filter((s) => /^bun (add|install)/.test(s.command)).map((s) => s.command)).toEqual([]);
    expect(steps.some((s) => s.command.startsWith("cd frontend && bun add"))).toBe(true);
  });
});
