import type { BuildStep, PackageManagerId, PlatformId, WizardSelections } from "./types";
import web from "@/data/web.json";
import mobile from "@/data/mobile.json";
import desktop from "@/data/desktop.json";
import addons from "@/data/addons.json";

export function catalogFor(platform: PlatformId) {
  if (platform === "mobile") return mobile;
  if (platform === "desktop") return desktop;
  return web;
}

// An option is visible only on its listed platforms (when set) and only when
// its allow-list (showWhen) matches and its deny-list (hideWhen) doesn't —
// e.g. Stripe's package differs per platform, Mongoose needs MongoDB.
// Used by the UI and the generator so hidden picks can never leak into the
// output (stale share links included).
export function isOptionVisible(opt: OptionLike, selections: WizardSelections): boolean {
  if (opt.platforms && !opt.platforms.includes(selections.platform ?? "web")) return false;
  for (const [groupId, allowed] of Object.entries(opt.showWhen ?? {})) {
    if (!allowed.includes(selections.addons[groupId] ?? "none")) return false;
  }
  for (const [groupId, denied] of Object.entries(opt.hideWhen ?? {})) {
    if (denied.includes(selections.addons[groupId] ?? "none")) return false;
  }
  return true;
}

// Per-platform overrides for options whose package differs per platform
// (Stripe web vs Stripe React Native, Clerk web vs Clerk Expo…).
function optionCommands(opt: OptionLike, platform: PlatformId): string[] {
  if (platform === "mobile" && opt.commandsMobile) return opt.commandsMobile;
  if (platform === "desktop" && opt.commandsDesktop) return opt.commandsDesktop;
  return opt.commands;
}

function optionNotes(opt: OptionLike, platform: PlatformId): string[] {
  if (platform === "mobile" && opt.notesMobile) return opt.notesMobile;
  if (platform === "desktop" && opt.notesDesktop) return opt.notesDesktop;
  return opt.notes;
}

// Client-side prefix per framework — server secrets never get this prefix.
function publicPrefix(framework: string): string {
  if (framework === "nextjs") return "NEXT_PUBLIC_";
  if (framework === "nuxt") return "NUXT_PUBLIC_";
  if (framework === "sveltekit") return "PUBLIC_";
  if (framework === "angular") return "NG_APP_";
  if (framework === "expo") return "EXPO_PUBLIC_";
  if (
    framework === "react-vite" ||
    framework === "vue" ||
    framework === "solid" ||
    framework === "tauri" ||
    framework === "electron" ||
    framework === "wails" ||
    framework === "ionic"
  )
    return "VITE_";
  return ""; // bare react-native — no prefix convention
}

// Wails runs npm/Vite inside frontend/ — a root .env would never be read.
function envFileFor(framework: string): string {
  if (framework === "nextjs") return ".env.local";
  if (framework === "wails") return "frontend/.env";
  return ".env";
}

// One env block per service: what keys to paste + where each value lives.
// Placeholders show the real format (sk_test_…, pk_test_…) so a blank
// `touch .env` never leaves the user guessing.
function envBlocks(sel: WizardSelections): { lines: string[]; services: string[] } {
  const lines: string[] = [
    "# StackWizard env — paste your real values below, then restart the dev server.",
    "# Never commit this file. Never paste real keys into chat or AI tools.",
  ];
  const services: string[] = [];
  const PUB = publicPrefix(sel.framework);
  const platform = sel.platform ?? "web";
  // Only emit keys for picks that actually install: a raw addon id can name an
  // option the current platform/framework hides (e.g. firebase-auth alongside
  // a Supabase database). Installs skip those via isOptionVisible — so does this.
  const live = (groupId: string, id: string): boolean => {
    if (id === "none") return false;
    const opt = addons.groups.find((g) => g.id === groupId)?.options?.find((o) => o.id === id);
    return !!opt && isOptionVisible(opt, sel);
  };
  const database = live("database", sel.addons.database ?? "none") ? sel.addons.database! : "none";
  const auth = live("auth", sel.addons.auth ?? "none") ? sel.addons.auth! : "none";
  const payments = sel.addons.payments || "none";
  const orm = sel.addons.orm || "none";

  const serverOnlyNote =
    PUB && PUB !== ""
      ? `# Server-only: no ${PUB} prefix on purpose — never expose in the browser.`
      : "# Server-only: never ship these to the browser.";

  if (database === "supabase" || auth === "supabase-auth") {
    services.push("Supabase");
    lines.push(
      "",
      "# Supabase — supabase.com/dashboard → your project → Settings → API",
      `${PUB}SUPABASE_URL=https://xyzcompany.supabase.co`,
      `${PUB}SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx`,
      serverOnlyNote,
      "SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxx",
    );
  }
  if (database === "firebase" || auth === "firebase-auth") {
    services.push("Firebase");
    lines.push(
      "",
      "# Firebase — console.firebase.google.com → Project settings → General → Your apps → SDK setup",
      `${PUB}FIREBASE_API_KEY=AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`,
      `${PUB}FIREBASE_AUTH_DOMAIN=my-app.firebaseapp.com`,
      `${PUB}FIREBASE_PROJECT_ID=my-app-id`,
      `${PUB}FIREBASE_STORAGE_BUCKET=my-app.appspot.com`,
      `${PUB}FIREBASE_MESSAGING_SENDER_ID=1234567890`,
      `${PUB}FIREBASE_APP_ID=1:1234567890:web:abc123def456`,
    );
  }
  if (database === "postgres" || database === "mysql" || database === "mongodb" || database === "sqlite") {
    if (database === "postgres") {
      services.push("Postgres");
      lines.push("", "# Postgres — matches the docker command above (user postgres, password dev)", "DATABASE_URL=postgresql://postgres:dev@localhost:5432/myapp");
    } else if (database === "mysql") {
      services.push("MySQL");
      lines.push("", "# MySQL — matches the docker command above (user root, password dev)", "DATABASE_URL=mysql://root:dev@localhost:3306/myapp");
    } else if (database === "mongodb") {
      services.push("MongoDB");
      lines.push("", "# MongoDB — matches the docker command above", "MONGODB_URI=mongodb://localhost:27017/myapp");
    } else {
      services.push("SQLite");
      lines.push("", "# SQLite — one file, created by the ORM on first run", "DATABASE_URL=file:./dev.db");
    }
    if (orm !== "none" && database === "mongodb" && orm !== "mongoose") {
      lines.push("# Note: this ORM expects a SQL driver — Mongoose is the MongoDB pick.");
    }
  }
  if (auth === "nextauth") {
    services.push("Auth.js");
    lines.push(
      "",
      "# Auth.js — authjs.dev → your provider → OAuth app. Generate the secret with: npx auth secret",
      "AUTH_SECRET=replace-with-32-char-random-string",
      "AUTH_GITHUB_ID=Iv1.xxxxxxxxxxxxxxxx",
      "AUTH_GITHUB_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );
  } else if (auth === "clerk") {
    services.push("Clerk");
    lines.push(
      "",
      "# Clerk — dashboard.clerk.com → API keys",
      `${PUB}CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
      serverOnlyNote,
      "CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );
  } else if (auth === "auth0") {
    services.push("Auth0");
    if (platform === "mobile") {
      lines.push(
        "",
        "# Auth0 — manage.auth0.com → Applications → your app → Settings",
        "AUTH0_DOMAIN=your-tenant.us.auth0.com",
        "AUTH0_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      );
    } else {
      lines.push(
        "",
        "# Auth0 — manage.auth0.com → Applications → your app → Settings. Generate AUTH0_SECRET with: openssl rand -hex 32",
        "AUTH0_SECRET=replace-with-32-char-random-string",
        "AUTH0_BASE_URL=http://localhost:3000",
        "AUTH0_ISSUER_BASE_URL=https://your-tenant.us.auth0.com",
        "AUTH0_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        serverOnlyNote,
        "AUTH0_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      );
    }
  }
  if (payments === "stripe") {
    services.push("Stripe");
    lines.push(
      "",
      "# Stripe — dashboard.stripe.com/test/apikeys for keys, /test/webhooks for the secret",
      "# Webhook secret for local dev: run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`",
      serverOnlyNote,
      "STRIPE_SECRET_KEY=sk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      `${PUB}STRIPE_PUBLISHABLE_KEY=pk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
      "STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );
  } else if (payments === "paypal") {
    services.push("PayPal");
    lines.push(
      "",
      "# PayPal — developer.paypal.com/dashboard → Sandbox → API credentials",
      serverOnlyNote,
      "PAYPAL_CLIENT_ID=AYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "PAYPAL_CLIENT_SECRET=EOxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      `${PUB}PAYPAL_CLIENT_ID=AYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
    );
  } else if (payments === "paddle") {
    services.push("Paddle");
    lines.push(
      "",
      "# Paddle — vendors.paddle.com → Developer Tools → Authentication + Notifications",
      serverOnlyNote,
      "PADDLE_API_KEY=pdl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "PADDLE_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      `${PUB}PADDLE_CLIENT_TOKEN=live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
      `${PUB}PADDLE_ENVIRONMENT=sandbox`,
    );
  } else if (payments === "razorpay") {
    services.push("Razorpay");
    lines.push(
      "",
      "# Razorpay — dashboard.razorpay.com → Settings → API Keys (Test Mode)",
      serverOnlyNote,
      "RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx",
      "RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx",
      `${PUB}RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx`,
    );
  } else if (payments === "revenuecat") {
    services.push("RevenueCat");
    lines.push(
      "",
      "# RevenueCat — app.revenuecat.com → API keys (one per store)",
      "REVENUECAT_APPLE_API_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "REVENUECAT_GOOGLE_API_KEY=goog_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );
  } else if (payments === "lemonsqueezy") {
    services.push("Lemon Squeezy");
    lines.push(
      "",
      "# Lemon Squeezy — app.lemonsqueezy.com → Settings → API + Webhooks",
      serverOnlyNote,
      "LEMONSQUEEZY_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "LEMONSQUEEZY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );
  }
  return { lines, services };
}

// TypeORM's driver follows the database — never a hardcoded `pg`.
const DB_DRIVER: Record<string, string> = {
  postgres: "pg",
  mysql: "mysql2",
  mongodb: "mongodb",
  sqlite: "sqlite3",
};

// ---- Production folder structure (2026 layout) ----
// Folders per framework; unknown frameworks emit nothing (skip silently).
// Starter files are zero-import (never break the build) except the Stripe
// webhook, which is emitted only when Stripe is picked (dep guaranteed).
const STRUCTURE_DIRS: Record<string, string[]> = {
  // Next.js is scaffolded with --src-dir, so every path lives under src/
  // (a root-level app/ dir would be silently ignored by the router).
  nextjs: [
    "src/app/(marketing)",
    "src/app/(app)",
    "src/app/api/health",
    "src/components/ui",
    "src/components/marketing",
    "src/components/app",
    "src/features",
    "src/lib",
    "src/hooks",
    "src/content",
    "tests/e2e",
  ],
  "react-vite": [
    "src/components",
    "src/features",
    "src/lib",
    "src/hooks",
    "src/content",
    "tests/e2e",
  ],
  // Vue (Vite): views + router + stores beside components. Env helper is the
  // same Vite import.meta variant as react-vite.
  vue: ["src/components", "src/views", "src/router", "src/stores", "src/composables", "src/lib"],
  // Nuxt 4 (app/ layout): server/api is additive — the template owns nuxt.config
  // and app.vue, which are never touched. Env uses runtimeConfig, so no stub.
  nuxt: [
    "app/components",
    "app/composables",
    "app/layouts",
    "app/middleware",
    "app/pages",
    "app/plugins",
    "app/utils",
    "server/api",
  ],
  // SvelteKit: health is an additive route file; the template owns
  // svelte.config and +page files, which are never touched.
  sveltekit: ["src/lib", "src/routes", "src/routes/api/health"],
  // Angular: feature dirs under src/app only. No stub — environments use
  // Angular's environment files, and app.config is template-owned.
  angular: ["src/app/components", "src/app/services", "src/app/guards", "src/app/interceptors", "src/app/models"],
  // Solid (Vite): routes convention for @solidjs/router + the Vite env helper.
  solid: ["src/components", "src/routes", "src/stores", "src/lib"],
  expo: ["src/app/(tabs)", "src/components", "src/hooks", "src/constants", "src/lib", "assets"],
  "react-native": ["src/screens", "src/navigation", "src/components", "src/lib", "src/hooks"],
  ionic: ["src/lib", "src/components", "src/hooks"],
  // Desktop: frontend dirs only — native shells (src-tauri, electron main,
  // wails backend) are template-owned, never scaffolded over.
  tauri: ["src/components", "src/lib", "src/hooks"],
  electron: ["src/components", "src/lib", "src/hooks"],
  wails: ["frontend/src/components", "frontend/src/lib", "frontend/src/hooks"],
};

// Dirs that stay empty (no starter file lands in them) get a .gitkeep.
const STRUCTURE_KEEP: Record<string, string[]> = {
  nextjs: [
    "src/app/(marketing)",
    "src/app/(app)",
    "src/components/ui",
    "src/components/marketing",
    "src/components/app",
    "src/features",
    "src/hooks",
    "src/content",
    "tests/e2e",
  ],
  "react-vite": ["src/components", "src/features", "src/hooks", "src/content", "tests/e2e"],
  vue: ["src/components", "src/views", "src/router", "src/stores", "src/composables"],
  nuxt: ["app/components", "app/composables", "app/layouts", "app/middleware", "app/pages", "app/plugins", "app/utils"],
  sveltekit: ["src/lib"],
  angular: ["src/app/components", "src/app/services", "src/app/guards", "src/app/interceptors", "src/app/models"],
  solid: ["src/components", "src/routes", "src/stores"],
  expo: ["src/app/(tabs)", "src/components", "src/hooks", "src/constants", "assets"],
  "react-native": ["src/screens", "src/navigation", "src/components", "src/hooks"],
  ionic: ["src/components", "src/hooks"],
  tauri: ["src/components", "src/hooks"],
  electron: ["src/components", "src/hooks"],
  wails: ["frontend/src/components", "frontend/src/hooks"],
};

const STUB_HEALTH = `export async function GET() {
  return Response.json({ ok: true });
}`;

// Nuxt server route — defineEventHandler is auto-imported, so zero imports.
const STUB_NUXT_HEALTH = `export default defineEventHandler(() => ({ ok: true }));`;

// SvelteKit endpoint — additive route file, no imports needed.
const STUB_SVELTE_HEALTH = `export function GET() {
  return Response.json({ ok: true });
};`;

const STUB_ENV_TS = `// Read env safely: required("STRIPE_SECRET_KEY") throws listing what's missing.
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing env: " + name + " — add it to .env.local");
  return value;
}`;

const STUB_ENV_JS = `// Read env safely: required("STRIPE_SECRET_KEY") throws listing what's missing.
export function required(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing env: " + name + " — add it to .env.local");
  return value;
}`;

const STUB_ENV_VITE_TS = `// Read env safely: required("VITE_API_URL") throws listing what's missing.
export function required(name: string): string {
  const value = import.meta.env[name] as string | undefined;
  if (!value) throw new Error("Missing env: " + name + " — add it to .env");
  return value;
}`;

const STUB_ENV_VITE_JS = `// Read env safely: required("VITE_API_URL") throws listing what's missing.
export function required(name) {
  const value = import.meta.env[name];
  if (!value) throw new Error("Missing env: " + name + " — add it to .env");
  return value;
}`;

// Mobile env helper — zero imports, new path only (lib/env), never a
// template-owned file. Reads lazily so it can't break the app boot.
const STUB_ENV_MOBILE_TS = `// Read env safely: required("API_URL") throws listing what's missing.
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing env: " + name + " — add it to .env");
  return value;
}`;

const STUB_ENV_MOBILE_JS = `// Read env safely: required("API_URL") throws listing what's missing.
export function required(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing env: " + name + " — add it to .env");
  return value;
}`;

const STUB_STRIPE_WH_TS = `import Stripe from "stripe";
export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Missing webhook secret", { status: 500 });
  try {
    const event = stripe.webhooks.constructEvent(await req.text(), sig, secret);
    if (event.type === "checkout.session.completed") {
      // TODO: fulfill the order here
    }
    return Response.json({ received: true });
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
}`;

const STUB_STRIPE_WH_JS = `import Stripe from "stripe";
export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Missing webhook secret", { status: 500 });
  try {
    const event = stripe.webhooks.constructEvent(await req.text(), sig, secret);
    if (event.type === "checkout.session.completed") {
      // TODO: fulfill the order here
    }
    return Response.json({ received: true });
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
}`;

const heredoc = (file: string, body: string) => `cat > ${file} <<'EOF'\n${body}\nEOF`;

function expandStructure(sel: WizardSelections): { command: string; note: string }[] {
  const out: { command: string; note: string }[] = [];
  const dirs = STRUCTURE_DIRS[sel.framework];
  if (!dirs) return out; // unknown framework — skip silently
  const ts = sel.language === "typescript";
  const ext = ts ? "ts" : "js";
  const stripe = (sel.addons.payments ?? "none") === "stripe";
  const allDirs = stripe && sel.framework === "nextjs" ? [...dirs, "src/app/api/webhooks/stripe"] : dirs;
  out.push({
    command: `mkdir -p ${allDirs.map((d) => `"${d}"`).join(" ")}`,
    note: "Makes production folders",
  });
  out.push({
    command: `touch ${STRUCTURE_KEEP[sel.framework].map((d) => `"${d}/.gitkeep"`).join(" ")}`,
    note: "Keeps empty folders in git",
  });
  if (sel.framework === "nextjs") {
    out.push({ command: heredoc(`src/app/api/health/route.${ext}`, STUB_HEALTH), note: "Checks your API is alive" });
    out.push({ command: heredoc(`src/lib/env.${ext}`, ts ? STUB_ENV_TS : STUB_ENV_JS), note: "Reads env with clear errors" });
    if (stripe) {
      out.push({
        command: heredoc(`src/app/api/webhooks/stripe/route.${ext}`, ts ? STUB_STRIPE_WH_TS : STUB_STRIPE_WH_JS),
        note: "Catches Stripe events",
      });
    }
  } else if (sel.framework === "react-vite" || sel.framework === "vue" || sel.framework === "solid") {
    // Vite-based UIs share the import.meta env helper.
    out.push({ command: heredoc(`src/lib/env.${ext}`, ts ? STUB_ENV_VITE_TS : STUB_ENV_VITE_JS), note: "Reads env with clear errors" });
  } else if (sel.framework === "nuxt") {
    // Additive server route — nuxt.config and app.vue are never touched.
    out.push({ command: heredoc(`server/api/health.get.${ext}`, STUB_NUXT_HEALTH), note: "Checks your API is alive" });
  } else if (sel.framework === "sveltekit") {
    // Additive endpoint — svelte.config and +page files are never touched.
    out.push({ command: heredoc(`src/routes/api/health/+server.${ext}`, STUB_SVELTE_HEALTH), note: "Checks your API is alive" });
  } else if (sel.framework === "angular") {
    // Folders only — environments use Angular's environment files and
    // app.config is template-owned, so no stub is emitted here.
  } else if (sel.framework === "expo" || sel.framework === "react-native" || sel.framework === "ionic") {
    // Mobile: folders + one zero-import helper in a new path. No stubs into
    // template-owned files (layouts, tabs, native dirs) — those are never
    // overwritten, so SDK/template drift can't break the scaffold.
    out.push({ command: heredoc(`src/lib/env.${ext}`, ts ? STUB_ENV_MOBILE_TS : STUB_ENV_MOBILE_JS), note: "Reads env with clear errors" });
  } else if (sel.framework === "tauri" || sel.framework === "electron" || sel.framework === "wails") {
    // Desktop: frontend dirs + a Vite env helper (all three render a Vite
    // React UI). Wails keeps its UI under frontend/ — match that layout.
    const envPath = sel.framework === "wails" ? `frontend/src/lib/env.${ext}` : `src/lib/env.${ext}`;
    out.push({ command: heredoc(envPath, ts ? STUB_ENV_VITE_TS : STUB_ENV_VITE_JS), note: "Reads env with clear errors" });
  }
  return out;
}

// Minimal shape the visibility/command helpers need — deliberately wider than
// StackOption so JSON-imported options (inferred `string[]`) stay assignable.
interface OptionLike {
  platforms?: string[];
  showWhen?: Record<string, string[]>;
  hideWhen?: Record<string, string[]>;
  commands: string[];
  notes: string[];
  commandsMobile?: string[];
  notesMobile?: string[];
  commandsDesktop?: string[];
  notesDesktop?: string[];
}

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
        image: "node:24",
        setup: "      - uses: actions/setup-node@v5\n        with:\n          node-version: 24\n          cache: npm",
      };
    case "yarn":
      return {
        install: "yarn install --frozen-lockfile",
        build: "yarn build",
        image: "node:24",
        setup: "      - uses: actions/setup-node@v5\n        with:\n          node-version: 24\n          cache: yarn",
      };
    case "pnpm":
      return {
        install: "pnpm install --frozen-lockfile",
        build: "pnpm build",
        image: "node:24",
        setup: "      - uses: pnpm/action-setup@v6\n        with:\n          version: 10\n      - uses: actions/setup-node@v5\n        with:\n          node-version: 24\n          cache: pnpm",
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
    "      - uses: actions/checkout@v5",
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

function resolveToken(cmd: string, pm: PackageManagerId, language: string, dir = "my-app"): string {
  const t = pmCommands(pm);
  const ts = language === "typescript";
  if (cmd === "__CI_FILE__") return githubCiFile(pm);
  if (cmd === "__GITLAB_CI_FILE__") return gitlabCiFile(pm);
  // Data files name the scaffold folder literally (cd my-app, init MyApp) —
  // rewrite those first, before tokens embed dir below (dir itself may
  // contain "my-app", e.g. my-app-2 — a later pass would double-rewrite it).
  const named = cmd.replaceAll("my-app", dir).replaceAll("MyApp", dir);
  return named
    .replaceAll("__DIR__", dir)
    .replaceAll("__PM_CREATE__", t.create)
    .replaceAll("__ADD__", t.add)
    .replaceAll("__ADD_DEV__", t.addDev)
    .replaceAll("__INSTALL__", t.install)
    .replaceAll("__PMX__", t.pmx)
    .replaceAll("__PM__", pm)
    .replaceAll(
      "__VITE_CREATE__",
      `${t.create} vite@latest ${dir} -- --template ${ts ? "react-ts" : "react"}`
    )
    .replaceAll(
      "__VITE_SOLID_CREATE__",
      `${t.create} vite@latest ${dir} -- --template ${ts ? "solid-ts" : "solid"}`
    )
    .replaceAll(
      "__NEXT_CREATE__",
      `${t.create} next-app@latest ${dir} ${ts ? "--ts" : "--js"} --tailwind --eslint --app --src-dir --import-alias "@/*" --use-${pm}`
    )
    .replaceAll(
      "__ELECTRON_CREATE__",
      `${t.pmx} create-electron-app@latest ${dir} --template=vite-${ts ? "typescript" : "javascript"}`
    )
    .replaceAll("__WAILS_INIT__", `wails init -n ${dir} -t react${ts ? "-ts" : ""}`);
}

// Folder the scaffold creates, from the user's app name. Slugs to
// lowercase-dashes; falls back to my-app on empty/garbage input. One
// exception: bare React Native, whose name doubles as the native module
// name and must be alphanumeric — "shop app" becomes Shopapp.
export function sanitizeAppName(
  raw: string | undefined,
  sel: Pick<WizardSelections, "platform" | "framework">
): string {
  const base = (raw ?? "").trim().slice(0, 60) || "my-app";
  if (sel.platform === "mobile" && sel.framework === "react-native") {
    const alpha = base.replace(/[^A-Za-z0-9]/g, "") || "MyApp";
    const fixed = /^[A-Za-z]/.test(alpha) ? alpha : `App${alpha}`;
    return fixed.charAt(0).toUpperCase() + fixed.slice(1);
  }
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "my-app";
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

function devCommand(
  pm: PackageManagerId,
  platform: PlatformId,
  framework: string,
  target: "android" | "ios"
): { command: string; note: string } {
  const t = pmCommands(pm);
  if (platform === "mobile") {
    if (framework === "expo")
      return target === "ios"
        ? {
            command: `${t.pmx} expo start`,
            note: "Opens the dev server — scan the QR with Camera, or press i for the simulator (needs a Mac)",
          }
        : {
            command: `${t.pmx} expo start`,
            note: "Opens the dev server — scan the QR in Expo Go, or press a for the emulator",
          };
    if (framework === "react-native")
      return target === "ios"
        ? {
            command: pm === "npm" ? "npm run ios" : `${t.run} ios`,
            note: "Runs on the iPhone simulator (needs macOS + Xcode)",
          }
        : {
            command: pm === "npm" ? "npm run android" : `${t.run} android`,
            note: "Runs on the Android emulator (needs Android Studio first)",
          };
    if (framework === "ionic")
      return {
        command: "ionic serve",
        note:
          target === "ios"
            ? "Serves your iPhone app in the browser (first time: npm i -g @ionic/cli)"
            : "Serves your Android app in the browser (first time: npm i -g @ionic/cli)",
      };
  }
  if (platform === "desktop") {
    if (framework === "tauri")
      return {
        command: pm === "npm" ? "npm run tauri dev" : `${t.run} tauri dev`,
        note: "Opens your app in a desktop window",
      };
    if (framework === "electron")
      return {
        command: pm === "npm" ? "npm start" : `${t.run} start`,
        note: "Opens your app in a desktop window",
      };
    if (framework === "wails")
      return {
        command: "wails dev",
        note: "Opens your app in a desktop window",
      };
  }
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
  const platform: PlatformId = selections.platform ?? "web";
  // Nothing picked yet — show a prompt, not half a setup.
  if (!framework) {
    return [
      {
        section: "Start",
        command: "# Answer the questions to generate your commands",
        note: "Pick a framework above — your commands appear here as you answer.",
      },
    ];
  }
  const catalog = catalogFor(platform);
  const dir = sanitizeAppName(selections.appName, selections);
  const steps: BuildStep[] = [];
  const push = (section: string, command: string, note: string) => {
    if (!command) return;
    const last = steps[steps.length - 1];
    if (last && last.command === command) return; // dedupe exact repeats
    steps.push({ section, command, note });
  };

  // 1 — project foundation
  const frameworkCat = catalog.categories.find((c) => c.id === "framework");
  const fw = frameworkCat?.options.find((o) => o.id === framework);
  if (fw) {
    fw.commands.forEach((raw, i) => {
      const cmd = resolveToken(raw, pm, language, dir);
      // Notes name the folder too ("in my-app") — keep them in sync.
      let note = (fw.notes[i] ?? "").replaceAll("my-app", dir).replaceAll("MyApp", dir);
      // `cd` mid-script is where copy-paste setups die (ENOENT: no package.json).
      // Pin the working directory expectation right where it changes — any
      // plain `cd <dir>`, never a compound line (the NestJS scaffold cds back).
      const cdMatch = /^cd ([A-Za-z0-9_-]+)$/.exec(cmd);
      if (cdMatch) note = `${note} — stay in ${cdMatch[1]} below`;
      push("1 · Create your project", cmd, note);
    });
  }

  // 2 — styling
  const stylingCat = catalog.categories.find((c) => c.id === "styling");
  const st = stylingCat?.options.find((o) => o.id === styling);
  if (st) {
    if (platform === "web" || platform === "desktop") {
      // Next.js already includes Tailwind — there is nothing to run, so emit
      // zero commands (never a fake "# ..." comment line in the copy output).
      if (styling === "tailwind" && framework !== "nextjs") {
        const tw = tailwindCommands(pm, framework);
        tw.commands.forEach((cmd, i) => push("2 · Add styling", cmd, tw.notes[i] ?? ""));
      }
    } else {
      st.commands.forEach((raw, i) => {
        const cmd = resolveToken(raw, pm, language, dir);
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
      if (toggle.platforms && !toggle.platforms.includes(platform)) continue;
      if (toggle.frameworks && !toggle.frameworks.includes(framework)) continue;
      toggle.commands.forEach((raw, i) => {
        // __STRUCTURE__ expands into the framework's folder layout + starter
        // files — never a literal command.
        if (raw === "__STRUCTURE__") {
          for (const s of expandStructure(selections)) push(`3 · ${group.label}`, s.command, s.note);
          return;
        }
        push(`3 · ${group.label}`, resolveToken(raw, pm, language, dir), toggle.notes[i] ?? "");
      });
    }
  }

  // 4+ — add-on option groups in file order (backend, database, orm, auth, payments, testing, cicd, ai, skills)
  const order = ["backend", "database", "orm", "auth", "payments", "testing", "cicd", "ai", "skills"];
  order.forEach((groupId, idx) => {
    const group = addons.groups.find((g) => g.id === groupId);
    if (!group?.options) return;
    if (group.dependsOn && group.showWhenNot) {
      const parentVal = selections.addons[group.dependsOn];
      // Group is hidden in the UI for these parent values (e.g. ORM for
      // hosted DBs) — ignore a stale value instead of emitting it.
      if (parentVal && group.showWhenNot.includes(parentVal)) return;
    }
    const val = selections.addons[groupId] || "none";
    if (val === "none") return;
    // One group is multi-choice (AI skills, comma-separated ids) — emit one
    // step per pick, in file order, under the same section number.
    const wanted =
      groupId === "skills"
        ? val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [val];
    for (const opt of group.options) {
      if (!wanted.includes(opt.id)) continue;
      if (!isOptionVisible(opt, selections)) continue;
      const cmds = optionCommands(opt, platform);
      const notes = optionNotes(opt, platform);
      cmds.forEach((raw, i) => {
        // __DB_DRIVER__ installs the driver for the chosen database (TypeORM).
        if (raw === "__DB_DRIVER__") {
          const driver = DB_DRIVER[selections.addons.database || "none"];
          if (!driver) return; // ORM is hidden for these DBs anyway — never a wrong driver
          push(`${4 + idx} · ${group.label}`, `${pmCommands(pm).add} ${driver}`, notes[i] ?? "");
          return;
        }      // AI rules files are generated from the live selections (stack-aware),
        // not from static strings — same heredoc pattern as the CI file steps.
        const cmd = AI_RULE_FILES[raw] ? aiRulesCommand(raw, selections) : resolveToken(raw, pm, language, dir);
        push(`${4 + idx} · ${group.label}`, cmd, notes[i] ?? "");
      });
    }
  });

  // Keys step — one env file with placeholders for every key the picks need
  // (Supabase URL, auth secrets, DB connection, payment keys). Single step on
  // purpose: one env file per project, never one command per service. The file
  // is pre-filled (not a blank `touch`) so setup.sh leaves a documented .env
  // showing each key, its format, and which dashboard it comes from.
  const backend = selections.addons.backend || "none";
  const database = selections.addons.database || "none";
  const auth = selections.addons.auth || "none";
  const payments = selections.addons.payments || "none";
  const usedNumbers = steps
    .map((s) => parseInt(s.section, 10))
    .filter((n) => !Number.isNaN(n));
  let nextNo = (usedNumbers.length ? Math.max(...usedNumbers) : 3) + 1;
  const needsEnv =
    database !== "none" ||
    auth !== "none" ||
    payments !== "none";
  if (needsEnv) {
    const envFile = envFileFor(framework);
    const env = envBlocks(selections);
    const who = env.services.length ? ` for ${env.services.join(" + ")}` : "";
    push(
      `${nextNo} · Save your keys`,
      `touch ${envFile}`,
      "Creates your env file. Never commit it."
    );
    // The scaffolds' default gitignores don't all cover our env filename —
    // back the "never commit it" promise with a real ignore line. Idempotent:
    // re-running the script never adds it twice.
    push(
      `${nextNo} · Save your keys`,
      `grep -qxF "${envFile}" .gitignore 2>/dev/null || echo "${envFile}" >> .gitignore`,
      "Keeps your keys out of git"
    );
    nextNo += 1;
  }

  // Backend runs in its own terminal — give it an explicit step so the user
  // doesn't try to serve frontend + backend with one command.
  if (backend === "nestjs") {
    const t = pmCommands(pm);
    const runCmd = pm === "npm" ? "npm run start:dev" : `${t.run} start:dev`;
    push(
      `${nextNo} · Run your backend`,
      `cd ../server && ${runCmd}`,
      "Starts your API"
    );
    nextNo += 1;
  }

  // Final — run it
  const dev = devCommand(pm, platform, framework, selections.target ?? "android");
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

// Folder the scaffold creates — the first plain `cd <dir>` step names it
// (my-app everywhere, MyApp for bare React Native). Used in the resume hint.
function scaffoldDir(setup: BuildStep[]): string {
  for (const s of setup) {
    const m = /^cd ([A-Za-z0-9_-]+)$/.exec(s.command);
    if (m) return m[1];
  }
  return "my-app";
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
    `# If you stopped it halfway, delete the partial folder first: rm -rf ${scaffoldDir(setup)}`,
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
  const platform: PlatformId = sel.platform ?? "web";
  const catalog = catalogFor(platform);
  const lang = sel.language === "typescript" ? "TypeScript" : "JavaScript";
  const fw = labelOf(catalog.categories.find((c) => c.id === "framework")?.options ?? [], sel.framework);
  const styling = labelOf(catalog.categories.find((c) => c.id === "styling")?.options ?? [], sel.styling);
  const extras: string[] = [];
  for (const gid of ["database", "auth", "payments"]) {
    const g = addons.groups.find((x) => x.id === gid);
    const val = sel.addons[gid] || "none";
    if (g && val !== "none") extras.push(`${g.label}: ${labelOf(g.options ?? [], val)}`);
  }
  const envFile = envFileFor(sel.framework);
  const target: "android" | "ios" = sel.target ?? "android";
  const dev = devCommand(pm, platform, sel.framework, target);
  const buildCmd =
    platform === "mobile"
      ? sel.framework === "expo"
        ? `${t.pmx} eas build -p ${target}`
        : sel.framework === "react-native"
          ? target === "ios"
            ? `${t.pmx} react-native run-ios --configuration Release`
            : "cd android && ./gradlew assembleRelease"
          : "ionic build"
      : platform === "desktop"
        ? sel.framework === "tauri"
          ? pm === "npm"
            ? "npm run tauri build"
            : `${t.run} tauri build`
          : sel.framework === "electron"
            ? pm === "npm"
              ? "npm run make"
              : `${t.run} make`
            : "wails build"
        : pm === "npm"
          ? "npm run build"
          : pm === "yarn"
            ? "yarn build"
            : `${t.run} build`;
  const lines = [
    "# AI rules (generated by StackWizard)",
    "## Stack",
    `- ${fw} + ${lang} + ${styling}, ${pm}${platform === "mobile" ? ` · Target: ${target === "ios" ? "iPhone" : "Android"}` : ""}`,
    ...(extras.length ? [`- ${extras.join(" · ")}`] : []),
    "## Commands (run inside " + sanitizeAppName(sel.appName, sel) + ")",
    `- Dev: ${dev.command}`,
    `- Build: ${buildCmd}`,
    ...(sel.toggles["eslint-prettier"] ? [`- Lint: ${t.pmx} eslint .`] : []),
    ...((sel.addons.testing || "none") !== "none"
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
    platform === "mobile"
      ? "- Use an error boundary around your navigation screens"
      : "- Use the framework's error boundary (Next.js error.tsx, React ErrorBoundary)",
  ];
  return lines.join("\n");
}

function aiRulesCommand(token: string, sel: WizardSelections): string {
  const file = AI_RULE_FILES[token] ?? "AGENTS.md";
  return [`cat > ${file} <<'EOF'`, aiRulesBody(sel), "EOF"].join("\n");
}

export function defaultSelections(): WizardSelections {
  return {
    platform: "web",
    target: "android",
    appName: "my-app",
    language: "",
    framework: "",
    styling: "",
    packageManager: "npm",
    toggles: { "eslint-prettier": true, husky: false, structure: true },
    addons: {
      backend: "",
      database: "",
      orm: "",
      auth: "",
      payments: "",
      testing: "",
      cicd: "",
      ai: "",
      skills: "",
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
      toggles: { "eslint-prettier": false, husky: false, structure: true },
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
      toggles: { "eslint-prettier": true, husky: true, structure: true },
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
  {
    id: "minimal-expo",
    label: "Simplest Expo app",
    detail: "Expo + built-in styling, plain and fast",
    selections: {
      ...defaultSelections(),
      platform: "mobile",
      framework: "expo",
      styling: "stylesheet",
      toggles: { "eslint-prettier": false, husky: false, structure: true },
    },
  },
  {
    id: "expo-shop",
    label: "Expo shop starter",
    detail: "Login + database + in-app purchases",
    selections: {
      ...defaultSelections(),
      platform: "mobile",
      framework: "expo",
      styling: "nativewind",
      toggles: { "eslint-prettier": true, husky: true, structure: true },
      addons: {
        backend: "none",
        database: "supabase",
        orm: "none",
        auth: "supabase-auth",
        payments: "revenuecat",
        testing: "maestro",
        cicd: "github-actions",
      },
    },
  },
  {
    id: "minimal-tauri",
    label: "Simplest desktop app",
    detail: "Tauri + plain CSS, tiny binary",
    selections: {
      ...defaultSelections(),
      platform: "desktop",
      framework: "tauri",
      styling: "plain-css",
      toggles: { "eslint-prettier": false, husky: false, structure: true },
    },
  },
  {
    id: "tauri-shop",
    label: "Tauri shop starter",
    detail: "Login + database + payments",
    selections: {
      ...defaultSelections(),
      platform: "desktop",
      framework: "tauri",
      styling: "tailwind",
      toggles: { "eslint-prettier": true, husky: true, structure: true },
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
];
