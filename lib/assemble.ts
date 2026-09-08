import type { BuildStep, PackageManagerId, WizardSelections } from "./types";
import web from "@/data/web.json";
import addons from "@/data/addons.json";

// Translate placeholder tokens in data files into real commands
// for the chosen package manager + language.
function pmCommands(pm: PackageManagerId) {
  switch (pm) {
    case "yarn":
      return {
        create: "yarn create",
        add: "yarn add",
        addDev: "yarn add -D",
        install: "yarn",
        pmx: "yarn dlx",
        run: "yarn",
      };
    case "pnpm":
      return {
        create: "pnpm create",
        add: "pnpm add",
        addDev: "pnpm add -D",
        install: "pnpm install",
        pmx: "pnpm dlx",
        run: "pnpm",
      };
    case "bun":
      return {
        create: "bun create",
        add: "bun add",
        addDev: "bun add -d",
        install: "bun install",
        pmx: "bunx",
        run: "bun run",
      };
    case "npm":
    default:
      return {
        create: "npm create",
        add: "npm install",
        addDev: "npm install -D",
        install: "npm install",
        pmx: "npx",
        run: "npm run",
      };
  }
}

function ciInstall(pm: PackageManagerId): { install: string; build: string; image: string; setup: string } {
  switch (pm) {
    case "npm":
      return {
        install: "npm ci",
        build: "npm run build",
        image: "node:22",
        setup: "      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm",
      };
    case "yarn":
      return {
        install: "yarn install --frozen-lockfile",
        build: "yarn build",
        image: "node:22",
        setup: "      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: yarn",
      };
    case "pnpm":
      return {
        install: "pnpm install --frozen-lockfile",
        build: "pnpm build",
        image: "node:22",
        setup: "      - uses: pnpm/action-setup@v4\n        with:\n          version: 9\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: pnpm",
      };
    case "bun":
    default:
      return {
        install: "bun install",
        build: "bun run build",
        image: "oven/bun:1",
        setup: "      - uses: oven-sh/setup-bun@v2",
      };
  }
}

function githubCiFile(pm: PackageManagerId): string {
  const c = ciInstall(pm);
  return [
    "cat > .github/workflows/node-ci.yml <<'EOF'",
    "name: CI",
    "on:",
    "  push:",
    "  pull_request:",
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    c.setup,
    `      - run: ${c.install}`,
    `      - run: ${c.build}`,
    "EOF",
  ].join("\n");
}

function gitlabCiFile(pm: PackageManagerId): string {
  const c = ciInstall(pm);
  return [
    "cat > .gitlab-ci.yml <<'EOF'",
    `image: ${c.image}`,
    "build:",
    "  script:",
    `    - ${c.install}`,
    `    - ${c.build}`,
    "EOF",
  ].join("\n");
}

function resolveToken(cmd: string, pm: PackageManagerId, language: string): string {
  const t = pmCommands(pm);
  const ts = language === "typescript";
  if (cmd === "__CI_FILE__") return githubCiFile(pm);
  if (cmd === "__GITLAB_CI_FILE__") return gitlabCiFile(pm);
  return cmd
    .replaceAll("__PM_CREATE__", t.create)
    .replaceAll("__ADD__", t.add)
    .replaceAll("__ADD_DEV__", t.addDev)
    .replaceAll("__INSTALL__", t.install)
    .replaceAll("__PMX__", t.pmx)
    .replaceAll("__PM__", pm)
    .replaceAll(
      "__VITE_CREATE__",
      `${t.create} vite@latest my-app -- --template ${ts ? "react-ts" : "react"}`
    )
    .replaceAll(
      "__VITE_SOLID_CREATE__",
      `${t.create} vite@latest my-app -- --template ${ts ? "solid-ts" : "solid"}`
    )
    .replaceAll(
      "__NEXT_CREATE__",
      `${t.create} next-app@latest my-app ${ts ? "--ts" : "--js"} --tailwind --eslint --app --src-dir --import-alias "@/*" --use-${pm}`
    );
}

function tailwindCommands(pm: PackageManagerId, framework: string): { commands: string[]; notes: string[] } {
  if (framework === "nextjs") {
    return {
      commands: [],
      notes: ["Tailwind is already included by the Next.js setup above — nothing extra to run."],
    };
  }
  const t = pmCommands(pm);
  // Tailwind v4: no init file, no autoprefixer — just the package + its PostCSS plugin.
  return {
    commands: [`${t.addDev} tailwindcss @tailwindcss/postcss`],
    notes: [
      'Adds Tailwind v4 (then @import "tailwindcss" in your CSS)',
    ],
  };
}

function devCommand(pm: PackageManagerId): { command: string; note: string } {
  const t = pmCommands(pm);
  const cmd = pm === "npm" ? "npm run dev" : `${t.run} dev`;
  return {
    command: cmd,
    note: "Starts your site in the browser",
  };
}

// Merge back-to-back installs with the same tool into one command,
// e.g. `bun add a` + `bun add b` → `bun add a b`. Dev and prod adds never merge.
function mergeInstallSteps(steps: BuildStep[]): BuildStep[] {
  const out: BuildStep[] = [];
  const addRe = /^(bun add(?: -d)?|npm install(?: -D)?|yarn add(?: -D)?|pnpm add(?: -D)?) /;
  for (const s of steps) {
    const last = out[out.length - 1];
    const mLast = last ? addRe.exec(last.command) : null;
    const mCur = addRe.exec(s.command);
    if (last && mLast && mCur && mLast[1] === mCur[1] && last.section === s.section) {
      last.command = `${last.command} ${s.command.slice(mCur[1].length + 1)}`;
      last.note = last.note ? `${last.note} + ${s.note.charAt(0).toLowerCase()}${s.note.slice(1)}` : s.note;
      continue;
    }
    out.push({ ...s });
  }
  return out;
}

export function assemble(selections: WizardSelections): BuildStep[] {
  const { language, framework, styling, packageManager: pm } = selections;
  const steps: BuildStep[] = [];
  const push = (section: string, command: string, note: string) => {
    if (!command) return;
    const last = steps[steps.length - 1];
    if (last && last.command === command) return; // dedupe exact repeats
    steps.push({ section, command, note });
  };

  // 1 — project foundation
  const frameworkCat = web.categories.find((c) => c.id === "framework");
  const fw = frameworkCat?.options.find((o) => o.id === framework);
  if (fw) {
    fw.commands.forEach((raw, i) => {
      const cmd = resolveToken(raw, pm, language);
      let note = fw.notes[i] ?? "";
      // `cd` mid-script is where copy-paste setups die (ENOENT: no package.json).
      // Pin the working directory expectation right where it changes.
      if (cmd === "cd my-app") note = `${note} — stay in my-app below`;
      push("1 · Create your project", cmd, note);
    });
  }

  // 2 — styling
  const stylingCat = web.categories.find((c) => c.id === "styling");
  const st = stylingCat?.options.find((o) => o.id === styling);
  if (st) {
    if (styling === "tailwind") {
      // Next.js already includes Tailwind — there is nothing to run, so emit
      // zero commands (never a fake "# ..." comment line in the copy output).
      if (framework !== "nextjs") {
        const tw = tailwindCommands(pm, framework);
        tw.commands.forEach((cmd, i) => push("2 · Add styling", cmd, tw.notes[i] ?? ""));
      }
    } else {
      st.commands.forEach((raw, i) => {
        const cmd = resolveToken(raw, pm, language);
        if (cmd) push("2 · Add styling", cmd, st.notes[i] ?? "");
        else if (st.notes[i]) push("2 · Add styling", `# ${st.notes[i]}`, st.notes[i]);
      });
    }
  }

  // 3 — code health toggles
  for (const group of addons.groups) {
    if (!group.toggles) continue;
    for (const toggle of group.toggles) {
      if (!selections.toggles[toggle.id]) continue;
      toggle.commands.forEach((raw, i) => {
        push(`3 · ${group.label}`, resolveToken(raw, pm, language), toggle.notes[i] ?? "");
      });
    }
  }

  // 4+ — add-on option groups in file order (backend, database, orm, auth, payments, testing, cicd, ai)
  const order = ["backend", "database", "orm", "auth", "payments", "testing", "cicd", "ai"];
  order.forEach((groupId, idx) => {
    const group = addons.groups.find((g) => g.id === groupId);
    if (!group?.options) return;
    if (group.dependsOn && group.showWhenNot) {
      const parentVal = selections.addons[group.dependsOn];
      if (parentVal && !group.showWhenNot.includes(parentVal)) {
        // ORM hidden for hosted DBs — but if user somehow has a value, ignore it
        if (selections.addons[groupId] && selections.addons[groupId] !== "none") return;
      }
      if (parentVal && group.showWhenNot.includes(parentVal) === false) return;
    }
    const val = selections.addons[groupId] ?? "none";
    const opt = group.options.find((o) => o.id === val);
    if (!opt || val === "none") return;
    opt.commands.forEach((raw, i) => {
      // AI rules files are generated from the live selections (stack-aware),
      // not from static strings — same heredoc pattern as the CI file steps.
      const cmd = AI_RULE_FILES[raw] ? aiRulesCommand(raw, selections) : resolveToken(raw, pm, language);
      push(`${4 + idx} · ${group.label}`, cmd, opt.notes[i] ?? "");
    });
  });

  // Keys step — one `touch` for every key the steps above asked for
  // (Supabase URL, auth secrets, payment keys). Single step on purpose:
  // one env file per project, never one command per service.
  const backend = selections.addons.backend ?? "none";
  const database = selections.addons.database ?? "none";
  const auth = selections.addons.auth ?? "none";
  const payments = selections.addons.payments ?? "none";
  const usedNumbers = steps
    .map((s) => parseInt(s.section, 10))
    .filter((n) => !Number.isNaN(n));
  let nextNo = (usedNumbers.length ? Math.max(...usedNumbers) : 3) + 1;
  const needsEnv =
    database === "supabase" ||
    database === "firebase" ||
    auth !== "none" ||
    (payments !== "none" && payments !== "lemonsqueezy");
  if (needsEnv) {
    const envFile = framework === "nextjs" ? ".env.local" : ".env";
    push(
      `${nextNo} · Save your keys`,
      `touch ${envFile}`,
      "Creates your env file. Never commit it."
    );
    nextNo += 1;
  }

  // Backend runs in its own terminal — give it an explicit step so the user
  // doesn't try to serve frontend + backend with one command.
  if (backend === "nestjs") {
    const t = pmCommands(pm);
    const runCmd = pm === "npm" ? "npm run start:dev" : `${t.run} start:dev`;
    // Nest defaults to port 3000 — same as Next. Pin 3001 per-run so no file
    // editing is needed and the two servers never collide.
    push(
      `${nextNo} · Run your backend`,
      `cd ../server && PORT=3001 ${runCmd}`,
      "In a second terminal: starts your API on 3001"
    );
    nextNo += 1;
  }

  // Final — run it
  const dev = devCommand(pm);
  push(`${nextNo} · See it running`, dev.command, dev.note);

  return mergeInstallSteps(steps);
}

// ---- One-file setup script: everything in one go, prompts auto-answered ----
const RUN_SECTIONS = ["See it running", "Run your backend"];

// Scaffolds that stop and ask questions mid-run (project name, options…).
// `yes ""` answers them all with defaults so the script never hangs.
function needsAutoYes(cmd: string): boolean {
  return /(create|init|nuxi|@angular\/cli|@nestjs\/cli new)/i.test(cmd);
}

export function buildScript(steps: BuildStep[]): string {
  const setup = steps.filter((s) => !RUN_SECTIONS.some((r) => s.section.includes(r)));
  const run = steps.filter((s) => RUN_SECTIONS.some((r) => s.section.includes(r)));
  // Echo-safe: escape everything the shell would expand inside double quotes.
  const esc = (t: string) =>
    t.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("$", "\\$").replaceAll("`", "\\`");
  const out = [
    "#!/usr/bin/env bash",
    "# Generated by StackWizard — your full setup in one file.",
    "# Usage: save as setup.sh, then run: bash setup.sh",
    "# Prompts are auto-answered with defaults. The final step stays manual (it keeps running).",
    '# If it pauses on "Resolving", it is downloading — give it a few minutes.',
    "# If you stopped it halfway, delete the partial folder first: rm -rf my-app",
    "set -e",
    "",
  ];
  for (const s of setup) {
    if (s.command.startsWith("#")) {
      out.push(s.command);
    } else {
      // Progress line first, so a slow download never looks frozen.
      if (s.note) out.push(`echo "→ ${esc(s.note)}"`);
      if (!needsAutoYes(s.command)) {
        out.push(s.command);
      } else if (s.command.includes("&&")) {
        // Compound line (e.g. cd out, scaffold, cd back): `yes |` would only feed
        // the first segment, so run the whole chain under one piped shell instead.
        out.push(`yes "" | bash -c '${s.command}'`);
      } else {
        out.push(`yes "" | ${s.command}`);
      }
    }
    out.push("");
  }
  if (run.length) {
    out.push('echo ""');
    out.push('echo "Setup done. Run these yourself (each keeps running):"');
    for (const s of run) {
      const safe = s.command.replaceAll("'", "'\\''");
      out.push(`echo '  $ ${safe}'`);
    }
  }
  return out.join("\n");
}

// ---- AI assistant rules files (stack-aware, generated from live selections) ----
const AI_RULE_FILES: Record<string, string> = {
  __AI_RULES_CURSOR__: ".muserules",
  __AI_RULES_COPILOT__: ".github/copilot-instructions.md",
  __AI_RULES_CLAUDE__: "CLAUDE.md",
  __AI_RULES_WINDSURF__: ".windsurfrules",
  __AI_RULES_GENERIC__: "AGENTS.md",
};

function labelOf(list: { id: string; label: string }[], id: string | undefined): string {
  return list.find((o) => o.id === id)?.label ?? id ?? "none";
}

function aiRulesBody(sel: WizardSelections): string {
  const t = pmCommands(sel.packageManager);
  const pm = sel.packageManager;
  const lang = sel.language === "typescript" ? "TypeScript" : "JavaScript";
  const fw = labelOf(web.categories.find((c) => c.id === "framework")?.options ?? [], sel.framework);
  const styling = labelOf(web.categories.find((c) => c.id === "styling")?.options ?? [], sel.styling);
  const extras: string[] = [];
  for (const gid of ["database", "auth", "payments"]) {
    const g = addons.groups.find((x) => x.id === gid);
    const val = sel.addons[gid] ?? "none";
    if (g && val !== "none") extras.push(`${g.label}: ${labelOf(g.options ?? [], val)}`);
  }
  const envFile = sel.framework === "nextjs" ? ".env.local" : ".env";
  const devCmd = pm === "npm" ? "npm run dev" : `${t.run} dev`;
  const buildCmd = pm === "npm" ? "npm run build" : pm === "yarn" ? "yarn build" : `${t.run} build`;
  const lines = [
    "# AI rules (generated by StackWizard)",
    "## Stack",
    `- ${fw} + ${lang} + ${styling}, ${pm}`,
    ...(extras.length ? [`- ${extras.join(" · ")}`] : []),
    "## Commands (run inside my-app)",
    `- Dev: ${devCmd}`,
    `- Build: ${buildCmd}`,
    ...(sel.toggles["eslint-prettier"] ? [`- Lint: ${t.pmx} eslint .`] : []),
    ...((sel.addons.testing ?? "none") !== "none"
      ? [`- Tests: ${pm === "npm" ? "npm test" : pm === "bun" ? "bun test" : `${pm} test`}`]
      : []),
    "## Rules",
    `- Keys go in ${envFile} — never commit it, never print it`,
    "- Don't change the package manager or framework without asking",
    "- After edits, run build and fix errors before finishing",
    "## Error handling",
    "- Validate all user input and API responses before use",
    "- Wrap data-fetching in try/catch with a user-visible fallback state",
    "- Never leave a promise unhandled; never swallow errors silently",
    "- Use the framework's error boundary (Next.js error.tsx, React ErrorBoundary)",
  ];
  return lines.join("\n");
}

function aiRulesCommand(token: string, sel: WizardSelections): string {
  const file = AI_RULE_FILES[token] ?? "AGENTS.md";
  return [`cat > ${file} <<'EOF'`, aiRulesBody(sel), "EOF"].join("\n");
}

export function defaultSelections(): WizardSelections {
  return {
    language: "typescript",
    framework: "nextjs",
    styling: "tailwind",
    packageManager: "npm",
    toggles: { "eslint-prettier": true, husky: false },
    addons: {
      backend: "none",
      database: "none",
      orm: "none",
      auth: "none",
      payments: "none",
      testing: "none",
      cicd: "none",
      ai: "none",
    },
  };
}

export const PRESETS: { id: string; label: string; detail: string; selections: WizardSelections }[] = [
  {
    id: "minimal-vite",
    label: "Simplest React site",
    detail: "React + Vite, plain and fast",
    selections: {
      ...defaultSelections(),
      framework: "react-vite",
      styling: "plain-css",
      toggles: { "eslint-prettier": false, husky: false },
    },
  },
  {
    id: "next-supabase-stripe",
    label: "Next.js shop starter",
    detail: "Login + database + payments",
    selections: {
      ...defaultSelections(),
      framework: "nextjs",
      styling: "tailwind",
      toggles: { "eslint-prettier": true, husky: true },
      addons: {
        backend: "none",
        database: "supabase",
        orm: "none",
        auth: "supabase-auth",
        payments: "stripe",
        testing: "vitest",
        cicd: "github-actions",
      },
    },
  },
  {
    id: "mern",
    label: "MERN classic",
    detail: "React + Express + MongoDB",
    selections: {
      ...defaultSelections(),
      framework: "react-vite",
      styling: "tailwind",
      addons: {
        backend: "express",
        database: "mongodb",
        orm: "mongoose",
        auth: "none",
        payments: "none",
        testing: "vitest",
        cicd: "none",
      },
    },
  },
];
