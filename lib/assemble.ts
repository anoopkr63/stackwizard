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
  // Blank framework (nothing picked yet) counts as visible — never hide
  // options before the user has chosen.
  if (opt.frameworks && selections.framework && !opt.frameworks.includes(selections.framework)) return false;
  for (const [groupId, allowed] of Object.entries(opt.showWhen ?? {})) {
    if (!allowed.includes(selections.addons[groupId] ?? "none")) return false;
  }
  for (const [groupId, denied] of Object.entries(opt.hideWhen ?? {})) {
    if (denied.includes(selections.addons[groupId] ?? "none")) return false;
  }
  return true;
}

// Per-framework overrides win (Clerk's package differs per framework),
// then per-platform overrides, then the base commands.
function optionCommands(opt: OptionLike, platform: PlatformId, framework: string): string[] {
  if (framework && opt.overrides?.[framework]?.commands) return opt.overrides[framework].commands;
  if (platform === "mobile" && opt.commandsMobile) return opt.commandsMobile;
  if (platform === "desktop" && opt.commandsDesktop) return opt.commandsDesktop;
  return opt.commands;
}

function optionNotes(opt: OptionLike, platform: PlatformId, framework: string): string[] {
  if (framework && opt.overrides?.[framework]?.notes) return opt.overrides[framework].notes;
  if (platform === "mobile" && opt.notesMobile) return opt.notesMobile;
  if (platform === "desktop" && opt.notesDesktop) return opt.notesDesktop;
  return opt.notes;
}

// Client-side prefix per framework — server secrets never get this prefix.
function publicPrefix(framework: string): string {
  if (framework === "nextjs") return "NEXT_PUBLIC_";
  if (framework === "nuxt") return "NUXT_PUBLIC_";
  // SvelteKit exposes only PUBLIC_-prefixed vars to the browser ($env/static/public).
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

// Next.js-only: Clerk's required middleware (fresh scaffolds don't ship
// one). The <ClerkProvider> wrap + sign-in buttons stay in the user's
// layout — template-owned, never touched. Dep guaranteed via the Clerk pick.
const STUB_CLERK_MIDDLEWARE = `import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};`;

// Next.js-only: Auth.js v5 config (GitHub provider, TODO for others).
// Reads AUTH_SECRET + AUTH_GITHUB_ID/SECRET from .env.local — the same
// keys the env step documents. Dep guaranteed via the NextAuth pick.
const STUB_NEXTAUTH_LIB = `import NextAuth from "next-auth";
import GitHub from "next-auth/providers/GitHub";

export const { handlers, auth } = NextAuth({
  providers: [GitHub],
  // TODO: add more providers here — keys go in .env.local
});`;

// Next.js-only: the catch-all route that serves the Auth.js handlers.
// Needs its dir (created by the Production folders step below).
const STUB_NEXTAUTH_ROUTE = `import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;`;

// ---- Service server stubs (Next.js routes, secret stays server-side) ------
// Next.js-only: order creation keeps RAZORPAY_KEY_SECRET server-side.
// The browser never imports "razorpay" — it calls this route, then hands
// the order to openRazorpayCheckout() in src/lib/razorpay.ts.
const STUB_RAZORPAY_ORDER_TS = `import Razorpay from "razorpay";

export async function POST(req: Request) {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return new Response("Missing Razorpay keys", { status: 500 });
  const { amount, currency } = (await req.json()) as { amount: number; currency?: string };
  if (!amount || amount < 100) return new Response("Invalid amount (paise, min 100)", { status: 400 });
  const rzp = new Razorpay({ key_id, key_secret });
  const order = await rzp.orders.create({ amount, currency: currency ?? "INR", receipt: "rcpt_" + Date.now() });
  return Response.json({ id: order.id, amount: order.amount, currency: order.currency });
}`;

const STUB_RAZORPAY_ORDER_JS = `import Razorpay from "razorpay";

export async function POST(req) {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return new Response("Missing Razorpay keys", { status: 500 });
  const { amount, currency } = await req.json();
  if (!amount || amount < 100) return new Response("Invalid amount (paise, min 100)", { status: 400 });
  const rzp = new Razorpay({ key_id, key_secret });
  const order = await rzp.orders.create({ amount, currency: currency ?? "INR", receipt: "rcpt_" + Date.now() });
  return Response.json({ id: order.id, amount: order.amount, currency: order.currency });
}`;

// Next.js-only: verifies the payment signature with HMAC (zero-dep, node
// crypto). Called by the frontend after the Razorpay popup succeeds.
const STUB_RAZORPAY_VERIFY_TS = `import { createHmac } from "crypto";

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return new Response("Missing Razorpay secret", { status: 500 });
  const { orderId, paymentId, signature } = (await req.json()) as {
    orderId: string;
    paymentId: string;
    signature: string;
  };
  const expected = createHmac("sha256", secret).update(orderId + "|" + paymentId).digest("hex");
  if (expected !== signature) return new Response("Bad signature", { status: 400 });
  // TODO: fulfill the order here
  return Response.json({ verified: true });
}`;

const STUB_RAZORPAY_VERIFY_JS = `import { createHmac } from "crypto";

export async function POST(req) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return new Response("Missing Razorpay secret", { status: 500 });
  const { orderId, paymentId, signature } = await req.json();
  const expected = createHmac("sha256", secret).update(orderId + "|" + paymentId).digest("hex");
  if (expected !== signature) return new Response("Bad signature", { status: 400 });
  // TODO: fulfill the order here
  return Response.json({ verified: true });
}`;
// Additive files under src/lib (never template-owned). Self-contained on
// purpose: they inline the env check instead of importing ./env, so they
// still work when the "Production folders" toggle is off.

function serviceAccess(framework: string): string {
  // Next.js reads process.env; native runtimes (Expo / bare React Native /
  // Ionic, per this repo's mobile env helper) also read process.env; every
  // Vite-family web UI reads import.meta.env.
  if (framework === "nextjs") return "process.env[name]";
  if (framework === "expo" || framework === "react-native" || framework === "ionic") return "process.env[name]";
  return "import.meta.env[name] as string | undefined";
}

// Frameworks whose env model the stubs below speak. Nuxt wants its module
// (@nuxtjs/supabase), Angular wants environment files — those get notes,
// not stubs. Mobile is in: native-safe stubs only (Supabase with an
// in-memory default, RevenueCat configure, Razorpay-native wrapper).
// Stripe/Clerk/Auth0 stay notes-only on mobile — their wiring lives in
// JSX providers and navigation, not a lib file.
const SERVICE_STUB_FRAMEWORKS = [
  "nextjs",
  "react-vite",
  "vue",
  "solid",
  "sveltekit",
  "tauri",
  "electron",
  "wails",
  "expo",
  "react-native",
  "ionic",
];

function requiredFn(sel: WizardSelections): string {
  const ts = sel.language === "typescript";
  const sig = ts ? "(name: string): string" : "(name)";
  return `function required${sig} {
  const value = ${serviceAccess(sel.framework)};
  if (!value) throw new Error("Missing env: " + name + " — add it to ${envFileFor(sel.framework)}");
  return value;
}`;
}

function supabaseStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  return `import { createClient } from "@supabase/supabase-js";

${requiredFn(sel)}

export const supabase = createClient(
  required("${PUB}SUPABASE_URL"),
  required("${PUB}SUPABASE_ANON_KEY")
);`;
}

function stripeStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  return `import { loadStripe } from "@stripe/stripe-js";

${requiredFn(sel)}

export const stripePromise = loadStripe(required("${PUB}STRIPE_PUBLISHABLE_KEY"));`;
}

function firebaseStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  const app = sel.language === "typescript"
    ? "const app = getApps().length ? getApps()[0]! : initializeApp({"
    : "const app = getApps().length ? getApps()[0] : initializeApp({";
  return `import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

${requiredFn(sel)}

${app}
  apiKey: required("${PUB}FIREBASE_API_KEY"),
  authDomain: required("${PUB}FIREBASE_AUTH_DOMAIN"),
  projectId: required("${PUB}FIREBASE_PROJECT_ID"),
  storageBucket: required("${PUB}FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: required("${PUB}FIREBASE_MESSAGING_SENDER_ID"),
  appId: required("${PUB}FIREBASE_APP_ID"),
});

export const firebaseAuth = getAuth(app);
export const firebaseDb = getFirestore(app);`;
}

// Razorpay's browser SDK is a <script> (checkout.js), not an npm import —
// this loader keeps the client zero-dep. The secret stays in the Next.js
// order/verify routes below, never in this file.
function razorpayClientStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  const ts = sel.language === "typescript";
  const win = ts ? "(window as any).Razorpay" : 'window["Razorpay"]';
  const ctor = ts ? "new (window as any).Razorpay({" : 'new window["Razorpay"]({';
  const sig = ts ? "(order: RazorpayOrder, prefill?: { name?: string; email?: string })" : "(order, prefill)";
  const iface = ts
    ? `export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

`
    : "";
  return `${requiredFn(sel)}

const CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckoutJs() {
  if (${win}) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CHECKOUT_JS;
    s.onload = () => resolve(undefined);
    s.onerror = () => reject(new Error("Could not load Razorpay checkout.js"));
    document.body.appendChild(s);
  });
}

${iface}// Create the order on your server first (POST /api/payments/razorpay/order),
// then pass it here to open the Razorpay popup.
export async function openRazorpayCheckout${sig} {
  await loadCheckoutJs();
  const key = required("${PUB}RAZORPAY_KEY_ID");
  const rzp = ${ctor}
    key,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    prefill,
  });
  rzp.open();
}`;
}

function paypalStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  return `import { loadScript } from "@paypal/paypal-js";

${requiredFn(sel)}

export function paypalScript() {
  return loadScript({ clientId: required("${PUB}PAYPAL_CLIENT_ID"), currency: "USD" });
}`;
}

function paddleStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  const envArg =
    sel.language === "typescript"
      ? 'required("${PUB}PADDLE_ENVIRONMENT") as "sandbox" | "production"'
      : 'required("${PUB}PADDLE_ENVIRONMENT")';
  return `import { initializePaddle } from "@paddle/paddle-js";

${requiredFn(sel)}

export function paddle() {
  return initializePaddle({
    token: required("${PUB}PADDLE_CLIENT_TOKEN"),
    environment: ${envArg},
  });
}`;
}

// ---- Native stubs (mobile only) ------------------------------------------
// Same rules as web: additive files under src/lib, self-contained env
// check, dep-guaranteed imports. Anything needing JSX providers or native
// config (StripeProvider, ClerkProvider) stays notes-only on purpose.

// Supabase on native: detectSessionInUrl must be off (no browser
// redirect). Sessions work in-memory out of the box; the AsyncStorage
// lines stay commented until the user installs the package — an
// uncommented import of a missing dep would break the build.
function supabaseMobileStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  const storagePkg = `${pmCommands(sel.packageManager).add} @react-native-async-storage/async-storage`;
  return `import { createClient } from "@supabase/supabase-js";
// import AsyncStorage from "@react-native-async-storage/async-storage";

${requiredFn(sel)}

export const supabase = createClient(
  required("${PUB}SUPABASE_URL"),
  required("${PUB}SUPABASE_ANON_KEY"),
  {
    auth: {
      // TODO: keep users logged in across restarts —
      // 1. Run: ${storagePkg}
      // 2. Uncomment the import above and the storage line below.
      // storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);`;
}

// RevenueCat on native (Expo / bare React Native): one configure call at
// startup picks the store key per platform. Dep guaranteed via the pick.
function revenuecatStub(sel: WizardSelections): string {
  return `import Purchases from "react-native-purchases";
import { Platform } from "react-native";

${requiredFn(sel)}

// Call once at startup (e.g. in your root layout) before showing paywalls.
export async function configurePurchases() {
  const apiKey =
    Platform.OS === "ios" ? required("REVENUECAT_APPLE_API_KEY") : required("REVENUECAT_GOOGLE_API_KEY");
  await Purchases.configure({ apiKey });
}`;
}

// Razorpay on native (Expo dev client / bare React Native): thin wrapper
// over the native module. The order still comes from your server — the
// key secret never ships in the app. Dep guaranteed via the pick.
function razorpayMobileStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  const ts = sel.language === "typescript";
  const sig = ts ? "(order: RazorpayOrder, options?: Record<string, unknown>)" : "(order, options)";
  const iface = ts
    ? `export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

`
    : "";
  return `import RazorpayCheckout from "react-native-razorpay";

${requiredFn(sel)}

${iface}// Create the order on your server first, then pass it here.
export function openRazorpayCheckout${sig} {
  return RazorpayCheckout.open({
    key: required("${PUB}RAZORPAY_KEY_ID"),
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    ...(options ?? {}),
  });
}`;
}

function libDir(framework: string): string {
  return framework === "wails" ? "frontend/src/lib" : "src/lib";
}

// True when the pick is live (visible for this platform/framework), so
// stale share-link values never emit stubs for hidden options.
export function isAddonLive(sel: WizardSelections, groupId: string, id: string): boolean {
  if (!id || id === "none") return false;
  const opt = addons.groups.find((g) => g.id === groupId)?.options?.find((o) => o.id === id);
  return !!opt && isOptionVisible(opt, sel);
}

// Tauri v2 reads CSP from src-tauri/tauri.conf.json > app.security.csp.
// The template ships null — merge a strict-enough CSP for the picked
// services via node. Guarded: never fails setup.sh, never overwrites.
function tauriCspSteps(flags: {
  supabase: boolean;
  stripe: boolean;
  firebase: boolean;
  razorpay: boolean;
  paypal: boolean;
  paddle: boolean;
  clerk: boolean;
  auth0: boolean;
}): { command: string; note: string }[] {
  const { supabase, stripe, firebase, razorpay, paypal, paddle, clerk, auth0 } = flags;
  if (!supabase && !stripe && !firebase && !razorpay && !paypal && !paddle && !clerk && !auth0) return [];
  const connect = ["'self'"];
  if (supabase) connect.push("https://*.supabase.co", "wss://*.supabase.co");
  if (stripe) connect.push("https://api.stripe.com", "https://*.stripe.com");
  if (firebase) connect.push("https://*.googleapis.com", "https://*.firebaseio.com", "wss://*.firebaseio.com");
  if (razorpay) connect.push("https://api.razorpay.com");
  if (paypal) connect.push("https://*.paypal.com");
  if (paddle) connect.push("https://*.paddle.com");
  if (clerk) connect.push("https://*.clerk.com", "https://*.clerk.accounts.dev");
  if (auth0) connect.push("https://*.auth0.com");
  const script = ["'self'"];
  if (stripe) script.push("https://js.stripe.com");
  if (firebase) script.push("https://www.gstatic.com", "https://apis.google.com");
  if (razorpay) script.push("https://checkout.razorpay.com");
  if (paypal) script.push("https://www.paypal.com", "https://www.paypalobjects.com");
  if (paddle) script.push("https://cdn.paddle.com");
  if (clerk) script.push("https://*.clerk.com");
  if (auth0) script.push("https://*.auth0.com");
  const frame: string[] = [];
  if (stripe) frame.push("https://js.stripe.com", "https://hooks.stripe.com");
  if (razorpay) frame.push("https://api.razorpay.com");
  if (paypal) frame.push("https://www.paypal.com", "https://www.sandbox.paypal.com");
  if (paddle) frame.push("https://*.paddle.com");
  if (clerk) frame.push("https://*.clerk.com");
  if (auth0) frame.push("https://*.auth0.com");
  const csp =
    `default-src 'self'; connect-src ${connect.join(" ")}; ` +
    `img-src 'self' data: https:; script-src ${script.join(" ")}; ` +
    `style-src 'self' 'unsafe-inline'` +
    (frame.length ? `; frame-src ${frame.join(" ")}` : "");
  const merger = `const fs = require("fs");
const p = "src-tauri/tauri.conf.json";
try {
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.app = j.app || {};
  j.app.security = j.app.security || {};
  if (!j.app.security.csp) {
    j.app.security.csp = "${csp}";
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\\n");
    console.log("CSP set in tauri.conf.json");
  } else {
    console.log("CSP already set — leaving it");
  }
} catch (e) {
  console.log("Could not update tauri.conf.json (" + e.message + ") — set app.security.csp by hand");
}`;
  return [
    { command: heredoc("tauri-csp.cjs", merger), note: "Writes a one-time CSP patch script (template config is never hand-edited)" },
    {
      command: "node tauri-csp.cjs; rm -f tauri-csp.cjs",
      note: "Sets a production CSP for your services (skipped if already set)",
    },
  ];
}

const heredoc = (file: string, body: string) => `cat > ${file} <<'EOF'\n${body}\nEOF`;

function expandStructure(sel: WizardSelections): { command: string; note: string }[] {
  const out: { command: string; note: string }[] = [];
  const dirs = STRUCTURE_DIRS[sel.framework];
  if (!dirs) return out; // unknown framework — skip silently
  const ts = sel.language === "typescript";
  const ext = ts ? "ts" : "js";
  // Selection + liveness (a stale share-link value for a hidden option
  // must never scaffold dirs or routes).
  const stripe = (sel.addons.payments ?? "none") === "stripe" && isAddonLive(sel, "payments", "stripe");
  const razorpay = (sel.addons.payments ?? "none") === "razorpay" && isAddonLive(sel, "payments", "razorpay");
  const nextauth = (sel.addons.auth ?? "none") === "nextauth" && isAddonLive(sel, "auth", "nextauth");
  const allDirs =
    sel.framework === "nextjs"
      ? [
          ...dirs,
          ...(stripe ? ["src/app/api/webhooks/stripe"] : []),
          ...(razorpay ? ["src/app/api/payments/razorpay/order", "src/app/api/payments/razorpay/verify"] : []),
          ...(nextauth ? ["src/app/api/auth/[...nextauth]"] : []),
        ]
      : dirs;
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
    if (razorpay) {
      out.push({
        command: heredoc(
          `src/app/api/payments/razorpay/order/route.${ext}`,
          ts ? STUB_RAZORPAY_ORDER_TS : STUB_RAZORPAY_ORDER_JS
        ),
        note: "Creates Razorpay orders (secret stays server-side)",
      });
      out.push({
        command: heredoc(
          `src/app/api/payments/razorpay/verify/route.${ext}`,
          ts ? STUB_RAZORPAY_VERIFY_TS : STUB_RAZORPAY_VERIFY_JS
        ),
        note: "Verifies Razorpay payments",
      });
    }
    if (nextauth) {
      out.push({
        // Brackets are quoted — an unquoted glob would expand if the dir exists.
        command: heredoc(`"src/app/api/auth/[...nextauth]/route.${ext}"`, STUB_NEXTAUTH_ROUTE),
        note: "Serves the Auth.js API (sign-in, callback, session)",
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
  frameworks?: string[];
  overrides?: { [k: string]: { commands: string[]; notes: string[] } | undefined };
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

// Reverse-domain id for Tauri (no dashes — "my-app" becomes myapp).
function tauriIdentifier(dir: string): string {
  const slug = dir.toLowerCase().replace(/[^a-z0-9]/g, "") || "myapp";
  return `com.stackwizard.${slug}`;
}

// Non-interactive Tauri scaffold: pinned React-TS template + manager +
// identifier + --yes, so setup.sh never hangs on prompts. Uses the pmx
// form on every manager (npx needs no extra `--`, yarn/pnpm/bunx neither).
function tauriCreate(pm: PackageManagerId, language: string, dir = "my-app"): string {
  const t = pmCommands(pm);
  const tpl = language === "typescript" ? "react-ts" : "react";
  return `${t.pmx} create-tauri-app@latest ${dir} --template ${tpl} --manager ${pm} --identifier ${tauriIdentifier(dir)} --yes`;
}

function resolveToken(cmd: string, pm: PackageManagerId, language: string, dir = "my-app"): string {
  const t = pmCommands(pm);
  const ts = language === "typescript";
  if (cmd === "__CI_FILE__") return githubCiFile(pm);
  if (cmd === "__GITLAB_CI_FILE__") return gitlabCiFile(pm);
  if (cmd === "__TAURI_CREATE__") return tauriCreate(pm, language, dir);
  // Wails keeps its UI under frontend/ — install there, then come back.
  if (cmd === "__WAILS_INSTALL__") return `cd frontend && ${t.install} && cd ..`;
  // Data files name the scaffold folder literally (cd my-app, init MyApp) —
  // rewrite those first, before tokens embed dir below (dir itself may
  // contain "my-app", e.g. my-app-2 — a later pass would double-rewrite it).
  const named = cmd.replaceAll("my-app", dir).replaceAll("MyApp", dir);
  const resolved = named
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
      // `npm create next-app@latest … --flags` eats every --flag as an npm
      // config (Unknown cli config "--ts"…), then runs
      // `npx "create-next-app" my-app @/*`. npm needs either a `--`
      // separator or a direct npx call — use npx (what Next.js docs show).
      // yarn/pnpm/bun pass args through `create` fine, so keep their form.
      pm === "npm"
        ? `${t.pmx} create-next-app@latest ${dir} ${ts ? "--ts" : "--js"} --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
        : `${t.create} next-app@latest ${dir} ${ts ? "--ts" : "--js"} --tailwind --eslint --app --src-dir --import-alias "@/*" --use-${pm}`
    )
    .replaceAll(
      "__ELECTRON_CREATE__",
      `${t.pmx} create-electron-app@latest ${dir} --template=vite-${ts ? "typescript" : "javascript"}`
    )
    .replaceAll("__WAILS_INIT__", `wails init -n ${dir} -t react${ts ? "-ts" : ""}`);
  // `bun create X` only resolves bun-create-* templates — plain create-*
  // packages (vue, svelte, vite, next-app) must go through bunx instead.
  if (pm === "bun") return resolved.replace(/^bun create /, "bunx create-");
  return resolved;
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

const STUB_POSTCSS = `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};`;

const STUB_TAILWIND_CSS = `@import "tailwindcss";`;

function tailwindCommands(pm: PackageManagerId, framework: string): { commands: string[]; notes: string[] } {
  if (framework === "nextjs") {
    return {
      commands: [],
      notes: ["Tailwind is already included by the Next.js setup above — nothing extra to run."],
    };
  }
  const t = pmCommands(pm);
  // Wails keeps its UI under frontend/ — every emitted path matches that layout.
  const root = framework === "wails" ? "frontend/" : "";
  // CSS entry per template layout (create-vue keeps it under assets/).
  const cssRel = framework === "vue" ? "src/assets/main.css" : "src/index.css";
  const cssPath = `${root}${cssRel}`;
  // Import spec relative to the entry file's own dir (both live under src/).
  const spec = `./${cssRel.replace(/^src\//, "")}`;
  const commands = [
    `${t.addDev} tailwindcss @tailwindcss/postcss`,
    heredoc(`${root}postcss.config.js`, STUB_POSTCSS),
    heredoc(cssPath, STUB_TAILWIND_CSS),
  ];
  const notes = [
    "Adds Tailwind v4 (PostCSS plugin)",
    "Wires Tailwind into PostCSS (new file — your vite config is untouched)",
    "Creates the Tailwind entry CSS (replaces the template's default styles)",
  ];
  // Entry file per framework (Solid boots from index.tsx, Vue from main.ts).
  // The append is guarded (no dupes) and null-safe under set -e.
  // Electron's Forge template layout varies — link the CSS by hand there.
  const entries =
    framework === "vue"
      ? ["src/main.ts", "src/main.js"]
      : framework === "solid"
        ? ["src/index.tsx", "src/index.jsx", "src/index.ts", "src/index.js"]
        : framework === "electron"
          ? []
          : [`${root}src/main.tsx`, `${root}src/main.ts`, `${root}src/main.jsx`, `${root}src/main.js`];
  if (entries.length) {
    const base = spec.split("/").pop() ?? "index.css";
    commands.push(
      `for f in ${entries.join(" ")}; do [ -f "$f" ] && { grep -q "${base}" "$f" || echo 'import "${spec}"' >> "$f"; } || true; done`
    );
    notes.push("Links the CSS entry into your main file (skipped if already linked)");
  } else {
    commands.push(`# Electron: add import "${spec}" to your renderer entry file`);
    notes.push("Link the CSS entry into your renderer entry file");
  }
  return { commands, notes };
}

// ---- Framework-correct lint setup ---------------------------------------
// The data toggle (generic eslint + create-config) is the fallback for
// frameworks not listed here (unknown only). Everything else gets the
// right plugin + a working flat config — never a React config for Vue.

function lintConfig(family: "vue" | "react" | "svelte", ts: boolean): string {
  const tsImport = ts ? 'import tseslint from "typescript-eslint";\n' : "";
  const tsWrapOpen = ts ? "export default tseslint.config(" : "export default [";
  const tsWrapClose = ts ? ");" : "];";
  const tsRecommended = ts ? "  ...tseslint.configs.recommended,\n" : "";
  const extra =
    family === "vue"
      ? '  ...vue.configs["flat/recommended"],\n'
      : family === "svelte"
        ? '  ...svelte.configs["flat/recommended"],\n'
        : "  react.configs.flat.recommended,\n";
  const pluginImport =
    family === "vue"
      ? 'import vue from "eslint-plugin-vue";\n'
      : family === "svelte"
        ? 'import svelte from "eslint-plugin-svelte";\n'
        : 'import react from "eslint-plugin-react";\n';
  const reactSettings =
    family === "react"
      ? ", settings: { react: { version: \"detect\" } }"
      : "";
  const ignores =
    family === "svelte"
      ? '["dist", ".svelte-kit", "build", "node_modules"]'
      : family === "react"
        ? '["dist", "build", "out", "node_modules"]'
        : '["dist", "node_modules"]';
  return `import js from "@eslint/js";
${tsImport}${pluginImport}import globals from "globals";
import prettier from "eslint-config-prettier";

${tsWrapOpen}
  { ignores: ${ignores} },
  js.configs.recommended,
${tsRecommended}${extra}  { languageOptions: { globals: globals.browser }${reactSettings} },
  prettier
${tsWrapClose}`;
}

// Empty array = fall through to the data toggle's generic commands.
function eslintSteps(
  pm: PackageManagerId,
  platform: PlatformId,
  framework: string,
  language: string
): { command: string; note: string }[] {
  const t = pmCommands(pm);
  const ts = language === "typescript";
  // Pin ESLint majors: floating `eslint` resolves to v10, which
  // typescript-eslint@8 / eslint-plugin-react@7 / plugin-vue@10 reject.
  const tsPkgs = ts ? " typescript-eslint@^8" : "";
  const base = "@eslint/js@^9 globals@^16 prettier@^3 eslint-config-prettier@^9";
  if (framework === "nextjs") {
    // create-next-app --eslint already ships ESLint + eslint-config-next.
    // Running create-config over it would clobber the template's
    // eslint.config.mjs with a generic React config and pull an @eslint/js
    // that conflicts with the template's eslint version (ERESOLVE on the
    // next install). Same reason as mobile below.
    return [{ command: `${t.addDev} prettier@^3 eslint-config-prettier@^9`, note: "Adds Prettier (your template already ships ESLint)" }];
  }
  if (platform === "mobile") {
    // Expo / RN / Ionic templates already ship ESLint — running
    // create-config over them would clobber the template config.
    return [{ command: `${t.addDev} prettier@^3`, note: "Adds Prettier (your template already ships ESLint)" }];
  }
  if (framework === "nuxt") {
    return [
      {
        command: `${t.addDev} @nuxt/eslint`,
        note: "Adds the official Nuxt ESLint module (then add @nuxt/eslint to modules in nuxt.config)",
      },
    ];
  }
  if (framework === "angular") {
    return [
      {
        command: `${t.addDev} prettier@^3`,
        note: "Adds Prettier (for Angular rules run: ng add angular-eslint and pick your major)",
      },
    ];
  }
  if (framework === "vue") {
    return [
      {
        command: `${t.addDev} eslint@^9 ${base}${tsPkgs} eslint-plugin-vue@^10`,
        note: "Adds ESLint + the Vue plugin (not React)",
      },
      {
        command: heredoc("eslint.config.js", lintConfig("vue", ts)),
        note: "Creates a Vue + TypeScript flat config",
      },
    ];
  }
  if (framework === "sveltekit") {
    return [
      {
        command: `${t.addDev} eslint@^9 ${base}${tsPkgs} eslint-plugin-svelte@^3`,
        note: "Adds ESLint + the Svelte plugin",
      },
      {
        command: heredoc("eslint.config.js", lintConfig("svelte", ts)),
        note: "Creates a Svelte flat config",
      },
    ];
  }
  if (framework === "solid") {
    // eslint-plugin-solid has no stable flat preset — install the base set
    // and point at the plugin docs instead of emitting a half-wired config.
    return [
      {
        command: `${t.addDev} eslint@^9 ${base}${tsPkgs}`,
        note: "Adds ESLint (then add eslint-plugin-solid per its docs for Solid rules)",
      },
    ];
  }
  if (framework === "react-vite" || framework === "tauri" || framework === "electron" || framework === "wails") {
    return [
      {
        command: `${t.addDev} eslint@^9 ${base}${tsPkgs} eslint-plugin-react@^7`,
        note: "Adds ESLint + the React plugin",
      },
      {
        command: heredoc(
          framework === "wails" ? "frontend/eslint.config.js" : "eslint.config.js",
          lintConfig("react", ts)
        ),
        note: "Creates a React + TypeScript flat config",
      },
    ];
  }
  if (framework === "ionic") {
    return [
      {
        command: `${t.addDev} eslint@^9 ${base}${tsPkgs} eslint-plugin-react@^7`,
        note: "Adds ESLint + the React plugin (merge with the template config if one exists)",
      },
    ];
  }
  return [];
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
  // Lib stubs heredoc into src/lib, which only exists when the Production
  // folders toggle (or the template) created it — with the toggle off,
  // `cat >` would die under `set -e` on a fresh scaffold. One idempotent
  // mkdir per dir, emitted before the first stub that needs it.
  const ensuredDirs = new Set<string>();
  const ensureDir = (section: string, dir: string) => {
    if (ensuredDirs.has(dir)) return;
    ensuredDirs.add(dir);
    push(section, `mkdir -p "${dir}"`, `Makes ${dir} (skipped if it exists)`);
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
      // NativeWind needs its Tailwind config to see your files — the babel +
      // metro half still follows the NativeWind setup docs (babel.config.js
      // is template-owned, never overwritten).
      if (styling === "nativewind") {
        push(
          "2 · Add styling",
          heredoc(
            "tailwind.config.js",
            `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};`
          ),
          "Adds the NativeWind Tailwind config (then finish the babel + metro setup per NativeWind docs)"
        );
      }
    }
  }

  // 3 — code health toggles
  for (const group of addons.groups) {
    if (!group.toggles) continue;
    for (const toggle of group.toggles) {
      if (!selections.toggles[toggle.id]) continue;
      if (toggle.platforms && !toggle.platforms.includes(platform)) continue;
      if (toggle.frameworks && !toggle.frameworks.includes(framework)) continue;
      // ESLint needs the framework's plugin + config (Vue gets the Vue
      // plugin, never React). Frameworks without a branch below fall
      // through to the toggle's generic data commands.
      if (toggle.id === "eslint-prettier") {
        const specific = eslintSteps(pm, platform, framework, language);
        if (specific.length) {
          for (const s of specific) push(`3 · ${group.label}`, s.command, s.note);
          continue;
        }
      }
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
      const cmds = optionCommands(opt, platform, framework);
      const notes = optionNotes(opt, platform, framework);
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
        let note = notes[i] ?? "";
        // The generated CI only runs install + web build — device binaries
        // and desktop installers need OS-specific runners. Say so inline.
        if ((raw === "__CI_FILE__" || raw === "__GITLAB_CI_FILE__") && platform !== "web") {
          note +=
            platform === "desktop"
              ? " (web build only — Tauri/Electron/Wails binaries need OS-specific runners; see their docs)"
              : " (install + web build only — store builds need EAS/Gradle/Xcode)";
        }
        push(`${4 + idx} · ${group.label}`, cmd, note);
      });
      // Wired client stubs for the picked services (additive files under
      // src/lib — the template's own files are never touched).
      if (SERVICE_STUB_FRAMEWORKS.includes(framework)) {
        const ts = selections.language === "typescript";
        const ext = ts ? "ts" : "js";
        const section = `${4 + idx} · ${group.label}`;
        const serverSideNote =
          platform === "desktop"
            ? " (publishable key only — secrets stay on a server)"
            : " (publishable key only — secrets stay server-side)";
        if (groupId === "database" && opt.id === "supabase") {
          ensureDir(section, libDir(framework));
          const mobile = platform === "mobile";
          push(
            section,
            heredoc(
              `${libDir(framework)}/supabase.${ext}`,
              mobile ? supabaseMobileStub(selections) : supabaseStub(selections)
            ),
            mobile
              ? "Creates the Supabase client for native (see the storage TODO to stay logged in)"
              : "Creates the Supabase client (reads your .env, throws naming what's missing)"
          );
        }
        // Firebase's web SDK speaks import.meta on Vite — wrong model for
        // native runtimes, so mobile keeps install + env keys + notes.
        if (groupId === "database" && opt.id === "firebase" && platform !== "mobile") {
          ensureDir(section, libDir(framework));
          push(section, heredoc(`${libDir(framework)}/firebase.${ext}`, firebaseStub(selections)), "Creates the Firebase app + auth + db (reads your .env, throws naming what's missing)");
        }
        if (groupId === "payments" && opt.id === "stripe" && platform !== "mobile") {
          ensureDir(section, libDir(framework));
          push(
            section,
            heredoc(`${libDir(framework)}/stripe.${ext}`, stripeStub(selections)),
            `Creates the Stripe client${serverSideNote}`
          );
        }
        if (groupId === "payments" && opt.id === "razorpay" && platform !== "mobile") {
          ensureDir(section, libDir(framework));
          push(
            section,
            heredoc(`${libDir(framework)}/razorpay.${ext}`, razorpayClientStub(selections)),
            `Opens the Razorpay popup (order comes from your server route${platform === "desktop" ? " — secrets stay on a server" : ""})`
          );
        }
        if (groupId === "payments" && opt.id === "paypal" && platform !== "mobile") {
          ensureDir(section, libDir(framework));
          push(
            section,
            heredoc(`${libDir(framework)}/paypal.${ext}`, paypalStub(selections)),
            `Loads the PayPal buttons script${serverSideNote}`
          );
        }
        if (groupId === "payments" && opt.id === "paddle" && platform !== "mobile") {
          ensureDir(section, libDir(framework));
          push(
            section,
            heredoc(`${libDir(framework)}/paddle.${ext}`, paddleStub(selections)),
            "Initializes Paddle (reads your .env, throws naming what's missing)"
          );
        }
        // Native payments (Expo / bare React Native — Ionic uses Capacitor,
        // not these native modules, so it keeps notes). Stripe stays
        // notes-only everywhere on mobile: it needs a <StripeProvider> wrap
        // in template-owned JSX, not a lib file.
        if (
          groupId === "payments" &&
          opt.id === "revenuecat" &&
          platform === "mobile" &&
          (framework === "expo" || framework === "react-native")
        ) {
          ensureDir(section, libDir(framework));
          push(
            section,
            heredoc(`${libDir(framework)}/purchases.${ext}`, revenuecatStub(selections)),
            "Configures RevenueCat (call configurePurchases() once at startup)"
          );
        }
        if (
          groupId === "payments" &&
          opt.id === "razorpay" &&
          platform === "mobile" &&
          (framework === "expo" || framework === "react-native")
        ) {
          ensureDir(section, libDir(framework));
          push(
            section,
            heredoc(`${libDir(framework)}/razorpay.${ext}`, razorpayMobileStub(selections)),
            "Opens Razorpay checkout (order comes from your server)"
          );
        }
        // Auth providers with real wiring (Next.js only — other frameworks
        // keep the install + env keys + notes, since their wiring lives in
        // template-owned files).
        if (groupId === "auth" && opt.id === "clerk" && framework === "nextjs") {
          push(
            section,
            heredoc("src/middleware.ts", STUB_CLERK_MIDDLEWARE),
            "Protects routes with Clerk (then wrap your layout in <ClerkProvider>)"
          );
        }
        if (groupId === "auth" && opt.id === "nextauth" && framework === "nextjs") {
          ensureDir(section, libDir(framework));
          push(
            section,
            heredoc(`${libDir(framework)}/auth.${ext}`, STUB_NEXTAUTH_LIB),
            "Configures Auth.js (GitHub provider — keys already in your .env)"
          );
        }
      }
    }
    // Firebase Auth without the Firebase database still needs the app client.
    // Selection equality matters here, not just visibility — otherwise any
    // auth pick (e.g. Clerk) with no database would emit a stray client.
    if (
      groupId === "auth" &&
      (selections.addons.auth ?? "none") === "firebase-auth" &&
      platform !== "mobile" &&
      isAddonLive(selections, "auth", "firebase-auth") &&
      SERVICE_STUB_FRAMEWORKS.includes(framework) &&
      !isAddonLive(selections, "database", selections.addons.database || "none")
    ) {
      const ts = selections.language === "typescript";
      const ext = ts ? "ts" : "js";
      ensureDir(`${4 + idx} · ${group.label}`, libDir(framework));
      push(
        `${4 + idx} · ${group.label}`,
        heredoc(`${libDir(framework)}/firebase.${ext}`, firebaseStub(selections)),
        "Creates the Firebase app + auth (reads your .env, throws naming what's missing)"
      );
    }
    // Supabase Auth without the Supabase database still needs the client.
    // Selection equality matters here, not just visibility — otherwise any
    // auth pick (e.g. Clerk) with no database would emit a stray client.
    if (
      groupId === "auth" &&
      (selections.addons.auth ?? "none") === "supabase-auth" &&
      isAddonLive(selections, "auth", "supabase-auth") &&
      SERVICE_STUB_FRAMEWORKS.includes(framework) &&
      !isAddonLive(selections, "database", selections.addons.database || "none")
    ) {
      const ts = selections.language === "typescript";
      const ext = ts ? "ts" : "js";
      ensureDir(`${4 + idx} · ${group.label}`, libDir(framework));
      const mobile = (selections.platform ?? "web") === "mobile";
      push(
        `${4 + idx} · ${group.label}`,
        heredoc(
          `${libDir(framework)}/supabase.${ext}`,
          mobile ? supabaseMobileStub(selections) : supabaseStub(selections)
        ),
        mobile
          ? "Creates the Supabase client for native (see the storage TODO to stay logged in)"
          : "Creates the Supabase client (reads your .env, throws naming what's missing)"
      );
    }
    // Test-script step stays inside the Testing group (numeric order).
    // Installing a runner alone leaves `npm test` broken (no script) — add
    // it portably via node (works on every manager). Maestro/Detox are
    // device binaries with their own CLIs — no script.
    if (groupId === "testing" && platform !== "mobile") {
      const picked = selections.addons.testing || "none";
      if (["vitest", "jest", "playwright", "cypress"].includes(picked)) {
        const runner =
          picked === "vitest"
            ? "vitest run"
            : picked === "jest"
              ? "jest"
              : picked === "playwright"
                ? "playwright test"
                : "cypress run";
        // Single-quoted JS, doubles inside, no $ or backticks.
        const setTest =
          `node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));` +
          `p.scripts=p.scripts||{};p.scripts.test="${runner}";` +
          `fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\\n")'`;
        push(
          `${4 + idx} · ${group.label}`,
          // Wails keeps its package.json under frontend/.
          framework === "wails" ? `cd frontend && ${setTest} && cd ..` : setTest,
          "Adds the test script (so npm/pnpm/yarn/bun test runs your suite)"
        );
      }
    }
  });

  // Test-script step — installing a runner alone leaves `npm test`
  // broken (no script). Add it portably via node (works on every manager).
  // Maestro/Detox are device binaries with their own CLIs — no script.
  const testing = selections.addons.testing || "none";
  if (["vitest", "jest", "playwright", "cypress"].includes(testing) && platform !== "mobile") {
    const runner =
      testing === "vitest"
        ? "vitest run"
        : testing === "jest"
          ? "jest"
          : testing === "playwright"
            ? "playwright test"
            : "cypress run";
    // __DB_DRIVER__-style quoting: single-quoted JS, doubles inside, no $ or backticks.
    const setTest =
      `node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));` +
      `p.scripts=p.scripts||{};p.scripts.test="${runner}";` +
      `fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\\n")'`;
    push(
      `${4 + order.indexOf("testing")} · Testing`,
      // Wails keeps its package.json under frontend/.
      framework === "wails" ? `cd frontend && ${setTest} && cd ..` : setTest,
      "Adds the test script (so npm/pnpm/yarn/bun test runs your suite)"
    );
  }

  // Tauri CSP — the template ships csp: null. Merge a strict-enough policy
  // for the picked services (guarded merge, never overwrites, never fails).
  if (framework === "tauri") {
    // Live pick per group ("none" when nothing picked or the value is stale/
    // hidden) — visibility alone is not enough, an unpicked but visible
    // option must not widen the CSP.
    const livePick = (groupId: string): string => {
      const id = selections.addons[groupId] || "none";
      return isAddonLive(selections, groupId, id) ? id : "none";
    };
    const db = livePick("database");
    const auth = livePick("auth");
    const payments = livePick("payments");
    const flags = {
      supabase: db === "supabase" || auth === "supabase-auth",
      stripe: payments === "stripe",
      firebase: db === "firebase" || auth === "firebase-auth",
      razorpay: payments === "razorpay",
      paypal: payments === "paypal",
      paddle: payments === "paddle",
      clerk: auth === "clerk",
      auth0: auth === "auth0",
    };
    if (Object.values(flags).some(Boolean)) {
      const used = steps.map((s) => parseInt(s.section, 10)).filter((n) => !Number.isNaN(n));
      const cspNo = (used.length ? Math.max(...used) : 3) + 1;
      for (const s of tauriCspSteps(flags)) {
        push(`${cspNo} · Desktop security`, s.command, s.note);
      }
    }
  }

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
    const envExample = `${envFile}.example`;
    const env = envBlocks(selections);
    const who = env.services.length ? ` for ${env.services.join(" + ")}` : "";
    // Pre-filled example (formats + dashboards), then a no-clobber copy —
    // never a blank `touch` that leaves the user guessing.
    push(
      `${nextNo} · Save your keys`,
      heredoc(envExample, env.lines.join("\n")),
      `Creates a documented env template${who}.`
    );
    push(
      `${nextNo} · Save your keys`,
      `cp -n ${envExample} ${envFile}`,
      framework === "angular"
        ? `Creates your env file${who} (Angular can't read it directly — copy values into src/environments/*). Never commit it.`
        : `Creates your env file${who} from the template (keeps yours if it exists). Never commit it.`
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

  // Service picks can converge on one install (Supabase DB + Supabase Auth
  // both need supabase-js) — rerunning is harmless but noisy, so keep the
  // first occurrence of any byte-identical command.
  const seen = new Set<string>();
  const deduped = steps.filter((s) => {
    if (seen.has(s.command)) return false;
    seen.add(s.command);
    return true;
  });
  return mergeInstallSteps(deduped);
}

// ---- One-file setup script: everything in one go, prompts auto-answered ----
const RUN_SECTIONS = ["See it running", "Run your backend"];

// Scaffolds that stop and ask questions mid-run (project name, options…).
// `yes ""` answers them all with defaults so the script never hangs.
// Already non-interactive commands (--yes) and plain `npm start`-style
// lines are excluded.
function needsAutoYes(cmd: string): boolean {
  if (cmd.includes("--yes")) return false;
  return /(create|init|nuxi|@angular\/cli|@nestjs\/cli new|@ionic\/cli)/i.test(cmd);
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
    // The generated project gets a real `test` script (js runners) or a
    // device-CLI flow (mobile) — point at the runner, never bare `npm test`.
    ...(() => {
      const picked = sel.addons.testing || "none";
      const runner =
        picked === "vitest"
          ? "vitest run"
          : picked === "jest"
            ? "jest"
            : picked === "playwright"
              ? "playwright test"
              : picked === "cypress"
                ? "cypress run"
                : picked === "maestro"
                  ? "maestro test"
                  : picked === "detox"
                    ? "detox test"
                    : "";
      if (!runner) return [];
      const cmd = picked === "maestro" || picked === "detox" ? runner : `${t.pmx} ${runner}`;
      return [`- Tests: ${cmd}`];
    })(),
    "## Rules",
    `- Keys go in ${envFile} — never commit it, never print it`,
    "- Don't change the package manager or framework without asking",
    "- After edits, run build and fix errors before finishing",
    "## Error handling",
    "- Validate all user input and API responses before use",
    "- Wrap data-fetching in try/catch with a user-visible fallback state",
    "- Never leave a promise unhandled; never swallow errors silently",
    sel.framework === "vue"
      ? "- Wrap views in onErrorCaptured + app.config.errorHandler with a fallback state"
      : sel.framework === "nuxt"
        ? "- Use Nuxt error.vue + onErrorCaptured with a fallback state"
        : sel.framework === "sveltekit"
          ? "- Use +error.svelte with a fallback state"
          : sel.framework === "angular"
            ? "- Implement a global ErrorHandler with a fallback view"
            : sel.framework === "solid"
              ? "- Wrap routes in Solid's ErrorBoundary with a fallback"
              : platform === "mobile"
                ? "- Use an error boundary around your navigation screens"
                : "- Use the framework's error boundary (Next.js error.tsx, React ErrorBoundary) with a fallback",
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
