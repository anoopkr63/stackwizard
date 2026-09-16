import type { BuildStep, PackageManagerId, PlatformId, WizardSelections } from "./types";
import addons from "@/data/addons.json";
import {
  catalogFor,
  defaultSelections,
  isOptionVisible,
  normalizeSelections,
  type OptionLike,
} from "./selections";

// The catalog/visibility/defaults helpers live in ./selections so that
// lib/share.ts can normalize without importing this module (circular import).
// Re-exported here because every existing caller imports them from @/lib/assemble.
export { catalogFor, defaultSelections, isOptionVisible, normalizeSelections };
export type { OptionLike };

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
  const payments = live("payments", sel.addons.payments ?? "none") ? sel.addons.payments! : "none";
  const orm = live("orm", sel.addons.orm ?? "none") ? sel.addons.orm! : "none";

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
      `# Auth.js — authjs.dev → your provider → OAuth app. Generate the secret with: ${pmCommands(sel.packageManager).pmxYes} auth secret`,
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
        "# Auth0 — manage.auth0.com → Applications → your app (Regular Web Application) → Settings.",
        "# These are the v4 keys @auth0/nextjs-auth0 reads — the v3 base-URL/issuer pair is gone.",
        "# Generate AUTH0_SECRET with: openssl rand -hex 32",
        "AUTH0_DOMAIN=your-tenant.us.auth0.com",
        "AUTH0_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "AUTH0_SECRET=replace-with-32-char-random-string",
        "APP_BASE_URL=http://localhost:3000",
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
      // Only Next.js gets a webhook route from this setup — everyone else
      // points the dashboard at their own server, so say that instead.
      sel.framework === "nextjs"
        ? "# Webhook secret for local dev: run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`"
        : "# Webhook secret: point a Stripe webhook at your server — the secret stays there, never in this file.",
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
      "# RevenueCat — app.revenuecat.com → API keys (one per store).",
      "# Store SDK keys are public by design — they ship inside the app bundle.",
      `${PUB}REVENUECAT_APPLE_API_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
      `${PUB}REVENUECAT_GOOGLE_API_KEY=goog_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
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

// Env helpers take the VALUE, never a computed key. Next.js and Expo only
// inline static `process.env.KEY` reads into browser/app bundles — a
// computed lookup is left untouched and reads undefined at runtime, so the
// old one-arg helper threw on every correctly-filled .env. (Next.js
// "Environment Variables": "dynamic lookups will not be inlined"; Expo:
// "Alternative versions of the expression are not supported ... will not be
// inlined".) Vite replaces `import.meta.env.KEY` the same way.
const STUB_ENV_TS = `// Read env safely — pass the value in:
//   required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL)
// Next.js only inlines static process.env.KEY reads — a computed lookup is not replaced.
export function required(name: string, value: string | undefined): string {
  if (!value) throw new Error("Missing env: " + name + " — add it to .env.local");
  return value;
}`;

const STUB_ENV_JS = `// Read env safely — pass the value in:
//   required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL)
// Next.js only inlines static process.env.KEY reads — a computed lookup is not replaced.
export function required(name, value) {
  if (!value) throw new Error("Missing env: " + name + " — add it to .env.local");
  return value;
}`;

const STUB_ENV_VITE_TS = `// Read env safely — pass the value in:
//   required("VITE_API_URL", import.meta.env.VITE_API_URL)
// Vite replaces static import.meta.env.KEY reads, never a computed lookup.
export function required(name: string, value: string | undefined): string {
  if (!value) throw new Error("Missing env: " + name + " — add it to .env");
  return value;
}`;

const STUB_ENV_VITE_JS = `// Read env safely — pass the value in:
//   required("VITE_API_URL", import.meta.env.VITE_API_URL)
// Vite replaces static import.meta.env.KEY reads, never a computed lookup.
export function required(name, value) {
  if (!value) throw new Error("Missing env: " + name + " — add it to .env");
  return value;
}`;

// Mobile env helper — zero imports, new path only (lib/env), never a
// template-owned file.
const STUB_ENV_MOBILE_TS = `// Read env safely — pass the value in:
//   required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL)
// Expo only inlines static process.env.KEY reads — a computed lookup is not replaced.
export function required(name: string, value: string | undefined): string {
  if (!value) throw new Error("Missing env: " + name + " — add it to .env");
  return value;
}`;

const STUB_ENV_MOBILE_JS = `// Read env safely — pass the value in:
//   required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL)
// Expo only inlines static process.env.KEY reads — a computed lookup is not replaced.
export function required(name, value) {
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

// ---- Supabase Edge Functions (Deno) for Stripe ---------------------------
// For stacks without API routes (anything but Next.js): the secret keys in
// .env can never run in the browser, so charging + webhooks live here.
// Deploy: supabase functions deploy create-checkout --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
// Call from your app: await supabase.functions.invoke("create-checkout", { body: { priceId } })
const STUB_EDGE_CHECKOUT = `// Creates a Stripe Checkout Session — your secret key stays on the server.
// Deploy once: supabase functions deploy create-checkout --no-verify-jwt
// Secrets (dashboard or CLI): STRIPE_SECRET_KEY
// From your app: const { data } = await supabase.functions.invoke("create-checkout", { body: { priceId } });
// Then redirect to data.url (web) or open it in the browser (desktop).
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) return new Response("Missing STRIPE_SECRET_KEY", { status: 500 });
  const stripe = new Stripe(secret, { httpClient: Stripe.createFetchHttpClient() });
  const { priceId, successUrl, cancelUrl } = await req.json().catch(() => ({}));
  if (!priceId) return new Response("Missing priceId", { status: 400 });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl ?? "http://localhost:1420/success",
    cancel_url: cancelUrl ?? "http://localhost:1420/cancelled",
  });
  return Response.json({ id: session.id, url: session.url });
});`;

const STUB_EDGE_WEBHOOK = `// Catches Stripe events (checkout.session.completed and friends).
// Deploy once WITHOUT JWT verification — Stripe sends no JWT:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets (dashboard or CLI): STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
// Dashboard → Developers → Webhooks → add the function URL, select events.
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    httpClient: Stripe.createFetchHttpClient(),
  });
  try {
    const event = await stripe.webhooks.constructEventAsync(await req.text(), sig, secret);
    if (event.type === "checkout.session.completed") {
      // TODO: fulfill the order here (e.g. update your Supabase tables)
    }
    return Response.json({ received: true });
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
});`;

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
// keys the env step documents. Dep guaranteed via the NextAuth pick, which
// installs next-auth@beta: the `latest` tag is still v4, whose API has no
// `handlers`/`auth` export at all. The provider module is lowercase on disk
// (providers/github.js) — "providers/GitHub" resolves only on a
// case-insensitive filesystem and dies in CI, Docker and on Linux.
const STUB_NEXTAUTH_LIB = `import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

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
// Additive files under src/lib (never template-owned). Stubs share one
// `required` helper from ./env (always co-emitted below, so they still work
// when the "Production folders" toggle is off). SvelteKit is the exception:
// it has no env file, so its stubs carry the $env check inline.

// The object each framework's env keys live on. Reads off it are always
// written out STATICALLY (`process.env.NEXT_PUBLIC_X`), because that is the
// only form Next.js, Expo and Vite replace at build time.
// SvelteKit exposes PUBLIC_* only via $env/dynamic/public (import.meta holds
// VITE_* there); every Vite-family UI (incl. Ionic React) reads
// import.meta.env.
function envAccessor(framework: string): string {
  if (framework === "nextjs") return "process.env";
  if (framework === "expo" || framework === "react-native") return "process.env";
  if (framework === "sveltekit") return "env";
  return "import.meta.env";
}

// One call shape for every stub: the key name (for the error message) plus a
// static read of that exact key (for the value).
function requiredCall(sel: WizardSelections, key: string): string {
  return `required("${key}", ${envAccessor(sel.framework)}.${key})`;
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

// The env helper matching the framework's env model — co-emitted with the
// service stubs so `import { required } from "./env"` never dangles.
function envStubFor(sel: WizardSelections): string {
  const ts = sel.language === "typescript";
  if (sel.framework === "nextjs") return ts ? STUB_ENV_TS : STUB_ENV_JS;
  if (sel.framework === "expo" || sel.framework === "react-native") return ts ? STUB_ENV_MOBILE_TS : STUB_ENV_MOBILE_JS;
  return ts ? STUB_ENV_VITE_TS : STUB_ENV_VITE_JS;
}

function requiredFn(sel: WizardSelections): string {
  // One shared helper (./env, co-emitted) — no copies in every stub.
  // SvelteKit has no env file, so its stubs carry the $env check inline
  // (hoisted ESM import stays valid after the package import above).
  if (sel.framework !== "sveltekit") return `import { required } from "./env";`;
  const ts = sel.language === "typescript";
  const sig = ts ? "(name: string, value: string | undefined): string" : "(name, value)";
  return `import { env } from "$env/dynamic/public";

function required${sig} {
  if (!value) throw new Error("Missing env: " + name + " — add it to ${envFileFor(sel.framework)}");
  return value;
}`;
}

function supabaseStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  return `import { createClient } from "@supabase/supabase-js";

${requiredFn(sel)}

export const supabase = createClient(
  ${requiredCall(sel, `${PUB}SUPABASE_URL`)},
  ${requiredCall(sel, `${PUB}SUPABASE_ANON_KEY`)}
);`;
}

function stripeStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  return `import { loadStripe } from "@stripe/stripe-js";

${requiredFn(sel)}

export const stripePromise = loadStripe(${requiredCall(sel, `${PUB}STRIPE_PUBLISHABLE_KEY`)});`;
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
  apiKey: ${requiredCall(sel, `${PUB}FIREBASE_API_KEY`)},
  authDomain: ${requiredCall(sel, `${PUB}FIREBASE_AUTH_DOMAIN`)},
  projectId: ${requiredCall(sel, `${PUB}FIREBASE_PROJECT_ID`)},
  storageBucket: ${requiredCall(sel, `${PUB}FIREBASE_STORAGE_BUCKET`)},
  messagingSenderId: ${requiredCall(sel, `${PUB}FIREBASE_MESSAGING_SENDER_ID`)},
  appId: ${requiredCall(sel, `${PUB}FIREBASE_APP_ID`)},
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
  const key = ${requiredCall(sel, `${PUB}RAZORPAY_KEY_ID`)};
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
  return loadScript({ clientId: ${requiredCall(sel, `${PUB}PAYPAL_CLIENT_ID`)}, currency: "USD" });
}`;
}

function paddleStub(sel: WizardSelections): string {
  const PUB = publicPrefix(sel.framework);
  // Single quotes here used to leave a literal `${PUB}` in the generated
  // file, so the key never matched anything in .env and paddle() threw.
  const envRead = requiredCall(sel, `${PUB}PADDLE_ENVIRONMENT`);
  const envArg = sel.language === "typescript" ? `${envRead} as "sandbox" | "production"` : envRead;
  return `import { initializePaddle } from "@paddle/paddle-js";

${requiredFn(sel)}

export function paddle() {
  return initializePaddle({
    token: ${requiredCall(sel, `${PUB}PADDLE_CLIENT_TOKEN`)},
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
  ${requiredCall(sel, `${PUB}SUPABASE_URL`)},
  ${requiredCall(sel, `${PUB}SUPABASE_ANON_KEY`)},
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
  const PUB = publicPrefix(sel.framework);
  return `import Purchases from "react-native-purchases";
import { Platform } from "react-native";

${requiredFn(sel)}

// Call once at startup (e.g. in your root layout) before showing paywalls.
export async function configurePurchases() {
  const apiKey =
    Platform.OS === "ios"
      ? ${requiredCall(sel, `${PUB}REVENUECAT_APPLE_API_KEY`)}
      : ${requiredCall(sel, `${PUB}REVENUECAT_GOOGLE_API_KEY`)};
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
    key: ${requiredCall(sel, `${PUB}RAZORPAY_KEY_ID`)},
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

// Next.js server routes a picked service cannot work without: the Stripe
// webhook, the Razorpay order/verify pair, the Auth.js catch-all handler.
// These used to live inside expandStructure, which only runs when the
// optional "Production folders" toggle is on — so turning the toggle off
// installed next-auth and wrote src/lib/auth.ts with nothing serving it
// (every /api/auth/* request 404s). They are emitted from the add-on
// section now, toggle or not. Every mkdir is -p, so the pair is idempotent
// when the folders step made the dir already.
function nextServiceRoutes(
  sel: WizardSelections,
  service: "stripe" | "razorpay" | "nextauth"
): { command: string; note: string }[] {
  const ts = sel.language === "typescript";
  const ext = ts ? "ts" : "js";
  if (service === "stripe") {
    return [
      { command: `mkdir -p "src/app/api/webhooks/stripe"`, note: "Makes the Stripe webhook folder (skipped if it exists)" },
      {
        command: heredoc(`src/app/api/webhooks/stripe/route.${ext}`, ts ? STUB_STRIPE_WH_TS : STUB_STRIPE_WH_JS),
        note: "Catches Stripe events",
      },
    ];
  }
  if (service === "razorpay") {
    return [
      {
        command: `mkdir -p "src/app/api/payments/razorpay/order" "src/app/api/payments/razorpay/verify"`,
        note: "Makes the Razorpay route folders (skipped if they exist)",
      },
      {
        command: heredoc(
          `src/app/api/payments/razorpay/order/route.${ext}`,
          ts ? STUB_RAZORPAY_ORDER_TS : STUB_RAZORPAY_ORDER_JS
        ),
        note: "Creates Razorpay orders (secret stays server-side)",
      },
      {
        command: heredoc(
          `src/app/api/payments/razorpay/verify/route.${ext}`,
          ts ? STUB_RAZORPAY_VERIFY_TS : STUB_RAZORPAY_VERIFY_JS
        ),
        note: "Verifies Razorpay payments",
      },
    ];
  }
  return [
    // Brackets are quoted — an unquoted glob would expand if the dir exists.
    { command: `mkdir -p "src/app/api/auth/[...nextauth]"`, note: "Makes the Auth.js route folder (skipped if it exists)" },
    {
      command: heredoc(`"src/app/api/auth/[...nextauth]/route.${ext}"`, STUB_NEXTAUTH_ROUTE),
      note: "Serves the Auth.js API (sign-in, callback, session)",
    },
  ];
}

function expandStructure(sel: WizardSelections): { command: string; note: string }[] {
  const out: { command: string; note: string }[] = [];
  const dirs = STRUCTURE_DIRS[sel.framework];
  if (!dirs) return out; // unknown framework — skip silently
  const ts = sel.language === "typescript";
  const ext = ts ? "ts" : "js";
  out.push({
    command: `mkdir -p ${dirs.map((d) => `"${d}"`).join(" ")}`,
    note: "Makes production folders",
  });
  out.push({
    command: `touch ${STRUCTURE_KEEP[sel.framework].map((d) => `"${d}/.gitkeep"`).join(" ")}`,
    note: "Keeps empty folders in git",
  });
  if (sel.framework === "nextjs") {
    out.push({ command: heredoc(`src/app/api/health/route.${ext}`, STUB_HEALTH), note: "Checks your API is alive" });
    out.push({ command: heredoc(`src/lib/env.${ext}`, ts ? STUB_ENV_TS : STUB_ENV_JS), note: "Reads env with clear errors" });
  } else if (sel.framework === "react-vite" || sel.framework === "vue" || sel.framework === "solid" || sel.framework === "ionic") {
    // Vite-based UIs share the import.meta env helper (Ionic React is Vite-based).
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
  } else if (sel.framework === "expo" || sel.framework === "react-native") {
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
        pmxYes: "yarn dlx",
        run: "yarn",
      };
    case "pnpm":
      return {
        create: "pnpm create",
        add: "pnpm add",
        addDev: "pnpm add -D",
        install: "pnpm install",
        pmx: "pnpm dlx",
        pmxYes: "pnpm dlx",
        run: "pnpm",
      };
    case "bun":
      return {
        create: "bun create",
        add: "bun add",
        addDev: "bun add -d",
        install: "bun install",
        pmx: "bunx",
        pmxYes: "bunx",
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
        // `npx` prompts before fetching a package it has never run; -y
        // answers it. dlx/bunx install without asking and would forward a
        // stray -y to the CLI itself, so they take the bare form.
        pmxYes: "npx -y",
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

// Not every scaffold ships a `build` script (Expo, bare React Native,
// Electron Forge) — CI that runs it goes red on the first push. null means
// install-only (still catches dependency rot on every push).
function ciBuild(pm: PackageManagerId, platform: PlatformId, framework: string): string | null {
  if (platform === "mobile" && framework !== "ionic") return null;
  if (framework === "electron") return null;
  return ciInstall(pm).build;
}

function githubCiFile(pm: PackageManagerId, platform: PlatformId = "web", framework = ""): string {
  const c = ciInstall(pm);
  // Wails keeps its package.json under frontend/ — run everything there.
  const cd = framework === "wails" ? "cd frontend && " : "";
  const build = ciBuild(pm, platform, framework);
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
    `      - run: ${cd}${c.install}`,
    ...(build ? [`      - run: ${cd}${build}`] : []),
    "EOF",
  ].join("\n");
}

function gitlabCiFile(pm: PackageManagerId, platform: PlatformId = "web", framework = ""): string {
  const c = ciInstall(pm);
  const cd = framework === "wails" ? "cd frontend && " : "";
  const build = ciBuild(pm, platform, framework);
  return [
    "cat > .gitlab-ci.yml <<'EOF'",
    `image: ${c.image}`,
    "build:",
    "  script:",
    `    - ${cd}${c.install}`,
    ...(build ? [`    - ${cd}${build}`] : []),
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

// npm/yarn/pnpm swallow everything after `create <pkg>` as their own config
// ("Unknown cli config --template"), so the flags need a `--` separator.
// bunx does NOT consume that separator — it hands the literal `--` to
// create-vite, whose parser then treats `--template` as a positional and
// silently scaffolds a VANILLA project (no React, no Solid). So bun gets the
// flags straight, everyone else keeps the separator.
function viteCreate(pm: PackageManagerId, dir: string, template: string): string {
  if (pm === "bun") return `bunx create-vite@latest ${dir} --template ${template}`;
  return `${pmCommands(pm).create} vite@latest ${dir} -- --template ${template}`;
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
    .replaceAll("__PMX_YES__", t.pmxYes)
    .replaceAll("__PMX__", t.pmx)
    .replaceAll("__PM__", pm)
    .replaceAll("__VITE_CREATE__", viteCreate(pm, dir, ts ? "react-ts" : "react"))
    .replaceAll("__VITE_SOLID_CREATE__", viteCreate(pm, dir, ts ? "solid-ts" : "solid"))
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
    // Forge ships @electron-forge/template-vite (JavaScript) and
    // @electron-forge/template-vite-typescript. There is no
    // "vite-javascript" template — Forge exits 1 with
    // "Failed to locate custom template".
    .replaceAll(
      "__ELECTRON_CREATE__",
      `${t.pmx} create-electron-app@latest ${dir} --template=${ts ? "vite-typescript" : "vite"}`
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

// Angular's builder (@angular/build) only looks for JSON PostCSS config —
// postcssConfigurationFiles = ['postcss.config.json', '.postcssrc.json'].
// A postcss.config.js is never read, so Tailwind silently does nothing and
// styles.css ships as a raw unprocessed @import.
const STUB_POSTCSS_JSON = `{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}`;

const STUB_TAILWIND_CSS = `@import "tailwindcss";`;

// ---- Mobile starters (pure React Native — no NativeWind dependency, so
// they render before and after the optional NativeWind setup) --------------
const STUB_EXPO_HOME = `import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>StackWizard app is running</Text>
      <Text style={styles.sub}>Edit src/app/index.tsx to start building.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#09090b" },
  title: { color: "#fafafa", fontSize: 24, fontWeight: "bold", textAlign: "center" },
  sub: { color: "#a1a1aa", marginTop: 12, textAlign: "center" },
});`;

const STUB_EXPO_EXPLORE = `import { StyleSheet, Text, View } from "react-native";

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.sub}>A second tab, ready for your content.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#09090b" },
  title: { color: "#fafafa", fontSize: 24, fontWeight: "bold", textAlign: "center" },
  sub: { color: "#a1a1aa", marginTop: 12, textAlign: "center" },
});`;

const STUB_RN_APP = `import React from "react";
import { StyleSheet, Text, View } from "react-native";

function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>StackWizard app is running</Text>
      <Text style={styles.sub}>Edit App.tsx to start building.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#09090b" },
  title: { color: "#fafafa", fontSize: 24, fontWeight: "bold", textAlign: "center" },
  sub: { color: "#a1a1aa", marginTop: 12, textAlign: "center" },
});

export default App;`;

function tailwindCommands(
  pm: PackageManagerId,
  framework: string,
  language: string
): { commands: string[]; notes: string[] } {
  if (framework === "nextjs") {
    return {
      commands: [],
      notes: ["Tailwind is already included by the Next.js setup above — nothing extra to run."],
    };
  }
  const t = pmCommands(pm);
  // Wails keeps its UI under frontend/ — every emitted path matches that layout.
  const root = framework === "wails" ? "frontend/" : "";
  // CSS entry per template layout (create-vue keeps it under assets/,
  // SvelteKit loads global CSS through the root layout as app.css, Angular
  // through angular.json as styles.css, Nuxt through nuxt.config as
  // app/assets/css/main.css).
  const cssRel =
    framework === "vue"
      ? "src/assets/main.css"
      : framework === "sveltekit"
        ? "src/app.css"
        : framework === "angular"
          ? "src/styles.css"
          : framework === "nuxt"
            ? "app/assets/css/main.css"
            : "src/index.css";
  const cssPath = `${root}${cssRel}`;
  // Import spec relative to the entry file's own dir (both live under src/).
  const spec = `./${cssRel.replace(/^src\//, "")}`;
  const postcssCommand =
    framework === "angular"
      ? heredoc(".postcssrc.json", STUB_POSTCSS_JSON)
      : heredoc(`${root}postcss.config.js`, STUB_POSTCSS);
  const postcssNote =
    framework === "angular"
      ? "Wires Tailwind into PostCSS (Angular only reads JSON config — a .js file is ignored)"
      : "Wires Tailwind into PostCSS (new file — your vite config is untouched)";
  const commands = [`${t.addDev} tailwindcss @tailwindcss/postcss`, postcssCommand, heredoc(cssPath, STUB_TAILWIND_CSS)];
  const notes = [
    "Adds Tailwind v4 (PostCSS plugin)",
    postcssNote,
    "Creates the Tailwind entry CSS (replaces the template's default styles)",
  ];
  if (framework === "sveltekit") {
    // SvelteKit has no main.* entry — the demo page becomes the Tailwind
    // starter and imports app.css itself, so no layout surgery is needed
    // (works whether or not the template shipped a +layout.svelte).
    commands.push(
      heredoc(
        "src/routes/+page.svelte",
        `<script>
	import '../app.css';
</script>

<main class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
	<div class="max-w-md text-center space-y-4">
		<h1 class="text-3xl font-bold">SvelteKit + Tailwind</h1>
		<p class="text-zinc-400">Your StackWizard app is running. Edit <code>src/routes/+page.svelte</code> to start building.</p>
	</div>
</main>`
      )
    );
    notes.push("Replaces the demo page with a Tailwind starter (loads app.css — no layout edit needed)");
    return { commands, notes };
  }
  if (framework === "react-vite" || framework === "tauri") {
    // Vite React templates ship a demo App + App.css that fights Tailwind
    // (and a main entry with the CSS import buried). Replace both with a
    // clean starter — full overwrites, so template drift can't break them.
    const ts = language === "typescript";
    const jtsx = ts ? "tsx" : "jsx";
    const appLabel = framework === "tauri" ? "Tauri + React + Tailwind" : "React + Vite + Tailwind";
    commands.push(
      heredoc(
        `src/App.${jtsx}`,
        `export default function App() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">${appLabel}</h1>
        <p className="text-zinc-400">
          Your StackWizard app is running. Edit <code>src/App.${jtsx}</code> to start building.
        </p>
      </div>
    </main>
  );
}`
      ),
      heredoc(
        `src/main.${jtsx}`,
        `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")${ts ? "!" : ""}).render(
  <StrictMode>
    <App />
  </StrictMode>
);`
      ),
      `rm -f src/App.css`
    );
    notes.push(
      "Replaces the demo App with a Tailwind starter (no App.css import)",
      "Rewrites the entry so the CSS import stays on top",
      "Deletes the template App.css (it fights Tailwind)"
    );
    return { commands, notes };
  }
  if (framework === "nuxt") {
    // Nuxt loads global CSS only via the `css` array in nuxt.config
    // (template-owned, never edited) — a conventional path alone does
    // nothing. Only create the file when the template didn't ship one, then
    // tell the user the one-line registration. The demo app.vue becomes a
    // Tailwind starter (it is the root component — safe to replace).
    commands[2] = `[ -f "${cssPath}" ] || ${commands[2]}`;
    notes[2] = "Creates the Tailwind entry CSS (skipped if the template shipped one)";
    commands.push(`# Nuxt: register it in nuxt.config.ts — css: ["~/assets/css/main.css"]`);
    notes.push('Register the CSS in nuxt.config.ts (css: ["~/assets/css/main.css"])');
    commands.push(
      heredoc(
        "app/app.vue",
        `<template>
  <main class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
    <div class="max-w-md text-center space-y-4">
      <h1 class="text-3xl font-bold">Nuxt + Tailwind</h1>
      <p class="text-zinc-400">Your StackWizard app is running. Edit <code>app/app.vue</code> to start building.</p>
    </div>
  </main>
</template>`
      )
    );
    notes.push("Replaces the demo page with a Tailwind starter");
    return { commands, notes };
  }
  if (framework === "angular") {
    // angular.json already loads src/styles.css — replacing that file is the
    // whole job, nothing to link. The demo component becomes an inline-
    // template starter (no html/css coupling), with a matching spec so
    // `ng test` stays green.
    commands.push(`# Angular: src/styles.css is loaded via angular.json — nothing to link`);
    notes.push("Replaces src/styles.css (already wired in angular.json — nothing to link)");
    // Angular 22 scaffolds src/app/app.ts (class App) + app.html + app.css +
    // app.spec.ts — the old app.component.* names have not been generated
    // since v19, so writing them left the real demo component untouched and
    // the new files dead. main.ts imports { App } from "./app/app", so the
    // file name and the class name both have to match. `standalone` is the
    // default now and the generated component no longer declares it.
    commands.push(
      heredoc(
        "src/app/app.ts",
        `import { Component } from "@angular/core";

@Component({
  selector: "app-root",
  imports: [],
  template: \`
    <main class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div class="max-w-md text-center space-y-4">
        <h1 class="text-3xl font-bold">{{ title }}</h1>
        <p class="text-zinc-400">Your StackWizard app is running. Edit <code>src/app/app.ts</code> to start building.</p>
      </div>
    </main>
  \`,
  styles: [],
})
export class App {
  protected readonly title = "StackWizard app is running";
}`
      ),
      heredoc(
        "src/app/app.spec.ts",
        `import { TestBed } from "@angular/core/testing";
import { App } from "./app";

describe("App", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it("should create the app", () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it("should render the title", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector("h1")?.textContent).toContain("StackWizard");
  });
});`
      ),
      `rm -f src/app/app.html src/app/app.css`
    );
    notes.push(
      "Replaces the demo component with a Tailwind starter (inline template, no html/css files)",
      "Replaces the spec to match (ng test stays green)",
      "Deletes the orphaned template + css"
    );
    return { commands, notes };
  }
  if (framework === "vue") {
    // main.ts already imports the CSS first — only the demo App and its
    // components go. The starter has no `lang` attribute, so it works in
    // TypeScript and JavaScript projects alike.
    commands.push(
      heredoc(
        "src/App.vue",
        `<template>
  <main class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
    <div class="max-w-md text-center space-y-4">
      <h1 class="text-3xl font-bold">Vue + Tailwind</h1>
      <p class="text-zinc-400">Your StackWizard app is running. Edit <code>src/App.vue</code> to start building.</p>
    </div>
  </main>
</template>`
      ),
      `rm -rf src/components`
    );
    notes.push(
      "Replaces the demo App with a Tailwind starter (works with or without TypeScript)",
      "Deletes the template demo components (nothing references them now)"
    );
    return { commands, notes };
  }
  if (framework === "solid") {
    // index.tsx already imports the CSS first — only the demo App goes.
    // Solid uses `class`, not `className`.
    const ext = language === "typescript" ? "tsx" : "jsx";
    commands.push(
      heredoc(
        `src/App.${ext}`,
        `export default function App() {
  return (
    <main class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div class="max-w-md text-center space-y-4">
        <h1 class="text-3xl font-bold">Solid + Tailwind</h1>
        <p class="text-zinc-400">Your StackWizard app is running. Edit <code>src/App.${ext}</code> to start building.</p>
      </div>
    </main>
  );
}`
      ),
      `rm -f src/App.css`
    );
    notes.push(
      "Replaces the demo App with a Tailwind starter",
      "Deletes the template App.css (it fights Tailwind)"
    );
    return { commands, notes };
  }
  if (framework === "electron") {
    // Forge's Vite template is vanilla TS: renderer entry + index.html, no
    // App component. Replace both (same script-tag contract), keep the CSS
    // import on top. One body serves both languages — it is type-free.
    const rfile = language === "typescript" ? "renderer.ts" : "renderer.js";
    const welcome = [
      '<main class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">',
      '<div class="max-w-md text-center space-y-4">',
      '<h1 class="text-3xl font-bold">Electron + Tailwind</h1>',
      '<p class="text-zinc-400">Your StackWizard app is running.</p>',
      "</div>",
      "</main>",
    ].join("");
    commands.push(
      heredoc(
        `src/${rfile}`,
        `import './index.css';

const root = document.getElementById('app');
if (root) {
  root.innerHTML = '${welcome}';
}`
      ),
      heredoc(
        "index.html",
        `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>StackWizard app</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/${rfile}"></script>
  </body>
</html>`
      )
    );
    notes.push(
      "Replaces the demo renderer with a Tailwind starter (CSS import on top)",
      "Rewrites index.html around the app root (same script tag)"
    );
    return { commands, notes };
  }
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

function lintConfig(family: "vue" | "react" | "svelte" | "vanilla", ts: boolean): string {
  const tsImport = ts ? 'import tseslint from "typescript-eslint";\n' : "";
  const tsWrapOpen = ts ? "export default tseslint.config(" : "export default [";
  const tsWrapClose = ts ? ");" : "];";
  const tsRecommended = ts ? "  ...tseslint.configs.recommended,\n" : "";
  const extra =
    family === "vue"
      ? '  ...vue.configs["flat/recommended"],\n'
      : family === "svelte"
        ? '  ...svelte.configs["flat/recommended"],\n'
        : family === "react"
          ? "  react.configs.flat.recommended,\n"
          : "";
  const pluginImport =
    family === "vue"
      ? 'import vue from "eslint-plugin-vue";\n'
      : family === "svelte"
        ? 'import svelte from "eslint-plugin-svelte";\n'
        : family === "react"
          ? 'import react from "eslint-plugin-react";\n'
          : "";
  const reactSettings =
    family === "react"
      ? ", settings: { react: { version: \"detect\" } }"
      : "";
  const ignores =
    family === "svelte"
      ? '["dist", ".svelte-kit", "build", "node_modules"]'
      : family === "react"
        ? '["dist", "build", "out", "node_modules"]'
        : family === "vanilla"
          ? '[".vite", "out", "node_modules"]'
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
        note: `Creates a Vue${ts ? " + TypeScript" : ""} flat config`,
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
  if (framework === "electron") {
    // Electron Forge's Vite template is vanilla JS/TS — src/renderer.js,
    // src/main.js, no component library at all. eslint-plugin-react there
    // lints rules for a framework the project never installs.
    return [
      {
        command: `${t.addDev} eslint@^9 ${base}${tsPkgs}`,
        note: "Adds ESLint (Forge's Vite template is vanilla — no React plugin)",
      },
      {
        command: heredoc("eslint.config.js", lintConfig("vanilla", ts)),
        note: `Creates a${ts ? " TypeScript" : " JavaScript"} flat config`,
      },
    ];
  }
  if (framework === "react-vite" || framework === "tauri" || framework === "wails") {
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
        note: `Creates a React${ts ? " + TypeScript" : ""} flat config`,
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

export function devCommand(
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
        // Via the package manager — no global `npm i -g` needed first.
        command: `${t.pmx} @ionic/cli serve`,
        note:
          target === "ios"
            ? "Serves your iPhone app in the browser"
            : "Serves your Android app in the browser",
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

// Wails keeps its package.json under frontend/ — the project root holds
// go.mod and main.go and no package.json at all, so a dependency command
// run there installs into the wrong place (or dies under `set -e`).
// Applied after merging so back-to-back installs still collapse first.
function runInFrontend(steps: BuildStep[], pm: PackageManagerId, framework: string): BuildStep[] {
  if (framework !== "wails") return steps;
  const t = pmCommands(pm);
  const prefixes = [t.add, t.addDev, t.install];
  return steps.map((s) => {
    if (s.command.includes("\n")) return s; // heredocs already name frontend/ paths
    if (s.command.startsWith("cd ")) return s; // already scoped (__WAILS_INSTALL__)
    if (!prefixes.some((p) => s.command === p || s.command.startsWith(`${p} `))) return s;
    return { ...s, command: `cd frontend && ${s.command} && cd ..` };
  });
}

// Sections are numbered while they are built (1 create, 2 styling, 3 code
// health, 4+ one per add-on group), so any section that emits nothing leaves
// a hole — Next.js + Tailwind runs no styling command at all and the copied
// list jumps straight from "1" to "3". Renumber whatever actually made it
// into the output, in order of first appearance. The unnumbered "Start"
// section is left alone.
function renumberSections(steps: BuildStep[]): BuildStep[] {
  const numbers = new Map<string, number>();
  for (const s of steps) {
    if (/^\d+ · /.test(s.section) && !numbers.has(s.section)) numbers.set(s.section, numbers.size + 1);
  }
  return steps.map((s) => {
    const m = /^\d+ · (.+)$/.exec(s.section);
    if (!m) return s;
    return { ...s, section: `${numbers.get(s.section)} · ${m[1]}` };
  });
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

export function assemble(input: WizardSelections): BuildStep[] {
  // Defence in depth: a stale share link (or a Wizard bug) can carry picks the
  // current platform/framework hides. Normalising here means no hidden pick
  // can ever reach a generated command, an env key or a stub file.
  const selections = normalizeSelections(input);
  const { language, framework, styling, packageManager: pm } = selections;
  const platform: PlatformId = selections.platform;
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
    if (!ensuredDirs.has(dir)) {
      ensuredDirs.add(dir);
      push(section, `mkdir -p "${dir}"`, `Makes ${dir} (skipped if it exists)`);
    }
    // Service stubs do `import { required } from "./env"` — co-emit that
    // helper here (byte-identical to the Production-folders step, so the
    // dedupe below collapses the pair when both run). SvelteKit stubs carry
    // the $env check inline instead — no env file exists there.
    if (selections.framework === "sveltekit") return;
    const ext = selections.language === "typescript" ? "ts" : "js";
    push(section, heredoc(`${dir}/env.${ext}`, envStubFor(selections)), "Reads env with clear errors");
  };

  // 1 — project foundation
  const frameworkCat = catalog.categories.find((c) => c.id === "framework");
  const fw = frameworkCat?.options.find((o) => o.id === framework);
  if (fw) {
    fw.commands.forEach((raw, i) => {
      let cmd = resolveToken(raw, pm, language, dir);
      // Notes name the folder too ("in my-app") — keep them in sync. The
      // Tauri/Electron scaffold notes name TypeScript — say the picked language.
      let note = (fw.notes[i] ?? "").replaceAll("my-app", dir).replaceAll("MyApp", dir);
      if (framework === "tauri" && language !== "typescript") note = note.replaceAll("React-TS", "React");
      if (framework === "electron" && language !== "typescript") note = note.replaceAll("Vite + TypeScript", "Vite + JavaScript");
      // create-vue runs interactively unless it gets a feature flag. npm /
      // yarn / pnpm need a `--` separator or they eat the flag themselves;
      // bunx passes flags straight through and would read a literal `--` as
      // the project directory — an invalid package name, which drops
      // create-vue back into the "Use TypeScript?" prompt and hangs setup.sh
      // forever. create-vue still has no no-TypeScript flag (--default now
      // scaffolds TypeScript too), so JavaScript stays a manual step.
      if (framework === "vue" && /(create-)?vue@latest/.test(cmd)) {
        if (language === "typescript") {
          const sep = pm === "bun" ? "" : "-- ";
          cmd = cmd.replace(/((?:create-)?vue@latest) (\S+)$/, `$1 ${sep}--ts $2`);
          note = `${note} (runs without prompts)`;
        } else {
          note = `${note} — answer the prompts yourself (say No to TypeScript for JavaScript)`;
        }
      }
      // `sv create` replaced `npm create svelte` (which now only prints a
      // deprecation notice). Flags make it fully non-interactive — but
      // `--types` only accepts `ts` or `jsdoc`; plain JavaScript is the
      // negated flag. `--types no-types` exits 1 ("argument 'no-types' is
      // invalid") before scaffolding anything.
      if (framework === "sveltekit" && cmd.includes("sv@latest create")) {
        const types = language === "typescript" ? "--types ts" : "--no-types";
        cmd += ` --template minimal ${types} --no-add-ons --no-install`;
      }
      // nuxi demands its picks up front in a pipe (it errors instead of
      // prompting). Template v4, your manager, no double install, no git.
      if (framework === "nuxt" && cmd.includes("nuxi@latest init")) {
        cmd += ` -t v4 --packageManager ${pm} --no-install --no-gitInit`;
      }
      // ng new prompts without --defaults (and hangs on a pipe). Pin CSS so
      // the Tailwind entry below always lands on src/styles.css.
      if (framework === "angular" && cmd.includes("@angular/cli")) {
        cmd += " --defaults --skip-git --skip-install --style=css";
      }
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
        const tw = tailwindCommands(pm, framework, language);
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

  // The Production-folders step above already created the lib dir — service
  // stubs must not echo a redundant second mkdir for it.
  if (selections.toggles["structure"] && STRUCTURE_DIRS[framework]) {
    ensuredDirs.add(libDir(framework));
  }

  // Clean starters for mobile templates (their demos are full sample apps,
  // not minimal entries). Unconditional — a sample app is never the right
  // starting point, whatever styling was picked. Same file contracts as the
  // templates (expo-router routes, RN default export), so nothing breaks.
  if (platform === "mobile") {
    const usedStarter = steps.map((s) => parseInt(s.section, 10)).filter((n) => !Number.isNaN(n));
    const starterNo = (usedStarter.length ? Math.max(...usedStarter) : 3) + 1;
    if (framework === "expo") {
      push(
        `${starterNo} · Starter screens`,
        heredoc("src/app/index.tsx", STUB_EXPO_HOME),
        "Replaces the demo home screen (pure React Native — renders before and after the NativeWind setup)"
      );
      push(
        `${starterNo} · Starter screens`,
        heredoc("src/app/explore.tsx", STUB_EXPO_EXPLORE),
        "Replaces the demo explore tab (same route, make it yours)"
      );
    }
    if (framework === "react-native") {
      push(
        `${starterNo} · Starter screen`,
        heredoc("App.tsx", STUB_RN_APP),
        "Replaces the demo App (same default export — index.js untouched)"
      );
    }
  }

  // 4+ — add-on option groups in file order (backend, database, orm, auth, payments, testing, cicd, ai, skills)
  const order = ["backend", "database", "orm", "auth", "payments", "graphics", "testing", "cicd", "ai", "skills"];
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
        }              // AI rules files are generated from the live selections (stack-aware),
        // not from static strings — same heredoc pattern as the CI file steps.
        // CI files are framework-aware too (some scaffolds have no `build`).
        const cmd =
          AI_RULE_FILES[raw]
            ? aiRulesCommand(raw, selections)
            : raw === "__CI_FILE__"
              ? githubCiFile(pm, platform, framework)
              : raw === "__GITLAB_CI_FILE__"
                ? gitlabCiFile(pm, platform, framework)
                : resolveToken(raw, pm, language, dir);
        let note = notes[i] ?? "";
        // The generated CI only runs what the scaffold supports — device
        // binaries and desktop installers need OS-specific runners. Say so inline.
        if (raw === "__CI_FILE__" || raw === "__GITLAB_CI_FILE__") {
          // Install-only job (no `build` script in the scaffold) — don't
          // promise a build in the progress line either.
          if (!ciBuild(pm, platform, framework)) note = note.replace("install + build", "install");
          if (platform === "desktop") {
            note +=
              framework === "electron"
                ? " (install only — desktop binaries need OS-specific runners; see the Electron docs)"
                : " (web build only — Tauri/Electron/Wails binaries need OS-specific runners; see their docs)";
          } else if (platform === "mobile" && framework !== "ionic") {
            note += " (install only — store builds need EAS/Gradle/Xcode)";
          }
        }
        push(`${4 + idx} · ${group.label}`, cmd, note);
      });
      // Wired client stubs for the picked services (additive files under
      // src/lib — the template's own files are never touched).
      if (SERVICE_STUB_FRAMEWORKS.includes(framework)) {
        const ts = selections.language === "typescript";
        const ext = ts ? "ts" : "js";
        const section = `${4 + idx} · ${group.label}`;
        const envFile = envFileFor(framework);
        const serverSideNote =
          platform === "desktop"
            ? " (publishable key only — secrets stay on a server)"
            : " (publishable key only — secrets stay server-side)";
        if (groupId === "database" && opt.id === "supabase") {
          ensureDir(section, libDir(framework));
          // Ionic runs in a WebView with localStorage — the plain web client
          // is correct there, not the native (AsyncStorage) variant.
          const mobile = platform === "mobile" && framework !== "ionic";
          push(
            section,
            heredoc(
              `${libDir(framework)}/supabase.${ext}`,
              mobile ? supabaseMobileStub(selections) : supabaseStub(selections)
            ),
            mobile
              ? "Creates the Supabase client for native (see the storage TODO to stay logged in)"
              : `Creates the Supabase client (reads your ${envFile}, throws naming what's missing)`
          );
        }
        // Firebase's web SDK speaks import.meta on Vite — wrong model for
        // native runtimes, so mobile keeps install + env keys + notes.
        if (groupId === "database" && opt.id === "firebase" && platform !== "mobile") {
          ensureDir(section, libDir(framework));
          push(section, heredoc(`${libDir(framework)}/firebase.${ext}`, firebaseStub(selections)), `Creates the Firebase app + auth + db (reads your ${envFile}, throws naming what's missing)`);
        }
        if (groupId === "payments" && opt.id === "stripe" && platform !== "mobile") {
          ensureDir(section, libDir(framework));
          push(
            section,
            heredoc(`${libDir(framework)}/stripe.${ext}`, stripeStub(selections)),
            `Creates the Stripe client${serverSideNote}`
          );
          if (framework === "nextjs") {
            for (const r of nextServiceRoutes(selections, "stripe")) push(section, r.command, r.note);
          }
        }
        if (groupId === "payments" && opt.id === "razorpay" && platform !== "mobile") {
          ensureDir(section, libDir(framework));
          push(
            section,
            heredoc(`${libDir(framework)}/razorpay.${ext}`, razorpayClientStub(selections)),
            platform === "desktop"
              ? "Opens the Razorpay popup (order comes from your server — secrets stay on a server)"
              : "Opens the Razorpay popup (order comes from your server route)"
          );
          if (framework === "nextjs") {
            for (const r of nextServiceRoutes(selections, "razorpay")) push(section, r.command, r.note);
          }
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
            `Initializes Paddle (reads your ${envFile}, throws naming what's missing)`
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
          for (const r of nextServiceRoutes(selections, "nextauth")) push(section, r.command, r.note);
        }
      }
      // Server side for Stripe on stacks without API routes (see the
      // STUB_EDGE_* headers for deploy + invoke docs). Framework-agnostic on
      // purpose — it works for stub-less frameworks (Nuxt, Angular) too.
      // Next.js already got a webhook route above; mobile stays notes-only
      // (PaymentSheet needs a PaymentIntent endpoint, not Checkout Sessions).
      if (
        groupId === "payments" &&
        opt.id === "stripe" &&
        framework !== "nextjs" &&
        platform !== "mobile" &&
        ((selections.addons.database === "supabase" && isAddonLive(selections, "database", "supabase")) ||
          (selections.addons.auth === "supabase-auth" && isAddonLive(selections, "auth", "supabase-auth")))
      ) {
        const section = `${4 + idx} · ${group.label}`;
        push(
          section,
          `mkdir -p "supabase/functions/create-checkout" "supabase/functions/stripe-webhook"`,
          "Makes the edge-function folders"
        );
        push(
          section,
          heredoc("supabase/functions/create-checkout/index.ts", STUB_EDGE_CHECKOUT),
          "Creates Checkout Sessions on your server (deploy with supabase functions deploy)"
        );
        push(
          section,
          heredoc("supabase/functions/stripe-webhook/index.ts", STUB_EDGE_WEBHOOK),
          "Catches Stripe events on your server (deploy with --no-verify-jwt)"
        );
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
        `Creates the Firebase app + auth (reads your ${envFileFor(framework)}, throws naming what's missing)`
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
      const mobile = (selections.platform ?? "web") === "mobile" && selections.framework !== "ionic";
      push(
        `${4 + idx} · ${group.label}`,
        heredoc(
          `${libDir(framework)}/supabase.${ext}`,
          mobile ? supabaseMobileStub(selections) : supabaseStub(selections)
        ),
        mobile
          ? "Creates the Supabase client for native (see the storage TODO to stay logged in)"
          : `Creates the Supabase client (reads your ${envFileFor(framework)}, throws naming what's missing)`
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
    // The template's beforeDevCommand/beforeBuildCommand say `npm run …`
    // even when scaffolded with another manager — Tauri would shell out to
    // npm on every `tauri dev`. Repoint at the picked manager (guarded:
    // never touches values the user already changed, never fails setup.sh).
    if (pm !== "npm") {
      const used = steps.map((s) => parseInt(s.section, 10)).filter((n) => !Number.isNaN(n));
      const secNo = (used.length ? Math.max(...used) : 3) + 1;
      const patcher = `const fs = require("fs");
const p = "src-tauri/tauri.conf.json";
try {
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.build = j.build || {};
  if (!j.build.beforeDevCommand || j.build.beforeDevCommand === "npm run dev") {
    j.build.beforeDevCommand = "${pm} run dev";
  }
  if (!j.build.beforeBuildCommand || j.build.beforeBuildCommand === "npm run build") {
    j.build.beforeBuildCommand = "${pm} run build";
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\\n");
  console.log("Tauri commands point at ${pm}");
} catch (e) {
  console.log("Could not update tauri.conf.json (" + e.message + ") — set build.beforeDevCommand by hand");
}`;
      push(
        `${secNo} · Desktop security`,
        heredoc("tauri-pm.cjs", patcher),
        "Writes a one-time Tauri patch script (template config is never hand-edited)"
      );
      push(
        `${secNo} · Desktop security`,
        "node tauri-pm.cjs; rm -f tauri-pm.cjs",
        `Points Tauri at ${pm} run dev/build (template defaults to npm)`
      );
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

  // Post-setup guide — always generated. New path (no template ships
  // START_HERE.md), so there is no clobber risk and no guard needed.
  push(
    `${nextNo} · Read this next`,
    heredoc("START_HERE.md", startHereBody(selections)),
    "Writes your post-setup guide (what to do next, in order)"
  );
  nextNo += 1;

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
  return renumberSections(runInFrontend(mergeInstallSteps(deduped), pm, framework));
}

// ---- One-file setup script: everything in one go, prompts auto-answered ----
const RUN_SECTIONS = ["See it running", "Run your backend"];

// Scaffolds that stop and ask questions mid-run (project name, options…).
// `yes ""` answers them all with defaults so the script never hangs.
// Already non-interactive commands (--yes) and plain `npm start`-style
// lines are excluded. Only the first line counts (heredoc bodies often
// contain "create"/"init"), and create/init must appear as their own token —
// a path like supabase/functions/create-checkout must not match.
function needsAutoYes(cmd: string): boolean {
  if (cmd.includes("--yes")) return false;
  const head = cmd.split("\n")[0];
  // Flag-driven scaffolds never prompt: create-vue with --ts/--default and
  // `sv create` with --template/--types/--no-add-ons. (Bare `create vue@`
  // without flags stays manual — piping `yes` into its prompts hangs.)
  if (/create[- ]vue@|create[- ]vite@|sv@latest create/.test(head)) return false;
  if (/(^|\s)(create|init)(-|$|\s)/i.test(head)) return true;
  return /(nuxi|@angular\/cli|@nestjs\/cli new|@ionic\/cli)/i.test(head);
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
  // Cursor reads project rules from .cursor/rules/*.mdc (each with YAML
  // frontmatter); the single-file .cursorrules form is the deprecated
  // legacy one and ".muserules" was never a file Cursor reads at all.
  __AI_RULES_CURSOR__: ".cursor/rules/stackwizard.mdc",
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
  for (const gid of ["database", "auth", "payments", "graphics"]) {
    const g = addons.groups.find((x) => x.id === gid);
    const val = sel.addons[gid] || "none";
    if (g && val !== "none") extras.push(`${g.label}: ${labelOf(g.options ?? [], val)}`);
  }
  const envFile = envFileFor(sel.framework);
  const target: "android" | "ios" = sel.target ?? "android";
  const dev = devCommand(pm, platform, sel.framework, target);
  const buildCmd = buildCmdFor(pm, platform, sel.framework, target);
  const testCmd = testCmdFor(sel);
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
    ...(testCmd ? [`- Tests: ${testCmd}`] : []),
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
  // .mdc rules only load when the frontmatter says so — alwaysApply: true is
  // the "always in context" rule type.
  const body =
    token === "__AI_RULES_CURSOR__"
      ? [
          "---",
          "description: Project stack and rules (generated by StackWizard)",
          "alwaysApply: true",
          "---",
          "",
          aiRulesBody(sel),
        ].join("\n")
      : aiRulesBody(sel);
  return [`cat > ${file} <<'EOF'`, body, "EOF"].join("\n");
}

// ---- Post-setup guide (START_HERE.md, always generated) -------------------
// Shared with the AI rules so both files name the same commands.
function buildCmdFor(
  pm: PackageManagerId,
  platform: PlatformId,
  framework: string,
  target: "android" | "ios"
): string {
  const t = pmCommands(pm);
  if (platform === "mobile") {
    if (framework === "expo") return `${t.pmx} eas build -p ${target}`;
    if (framework === "react-native")
      return target === "ios" ? `${t.pmx} react-native run-ios --configuration Release` : "cd android && ./gradlew assembleRelease";
    return "ionic build";
  }
  if (platform === "desktop") {
    if (framework === "tauri") return pm === "npm" ? "npm run tauri build" : `${t.run} tauri build`;
    if (framework === "electron") return pm === "npm" ? "npm run make" : `${t.run} make`;
    return "wails build";
  }
  if (pm === "npm") return "npm run build";
  if (pm === "yarn") return "yarn build";
  return `${t.run} build`;
}

// "" when no runner was picked. JS runners get a real `test` script;
// Maestro/Detox are device CLIs with their own commands.
function testCmdFor(sel: WizardSelections): string {
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
  if (!runner) return "";
  return picked === "maestro" || picked === "detox" ? runner : `${pmCommands(sel.packageManager).pmx} ${runner}`;
}

// "Still needs code" list — the single source of truth for both the guide
// (START_HERE.md) and the wizard's on-page panel. Commands scaffold; they
// don't write app code, so name exactly what is left.
export function codeGapsFor(sel: WizardSelections, platform: PlatformId): string[] {
  const s = normalizeSelections(sel);
  const gaps: string[] = [];
  if ((s.addons.backend || "none") !== "none") gaps.push("API: add GET /health + login checks.");
  const auth = s.addons.auth || "none";
  if (auth !== "none") {
    gaps.push(
      platform === "mobile"
        ? "Login: wire the provider SDK into your navigation."
        : platform === "desktop"
          ? "Login: wire the provider SDK into your app window."
          : auth === "clerk" && s.framework === "nextjs"
            ? "Login: wrap your layout in <ClerkProvider> + add sign-in buttons."
            : auth === "nextauth"
              ? "Login: add your OAuth credentials + check the session with auth()."
              : "Login: add callback route + session check."
    );
  }
  const pay = s.addons.payments || "none";
  if (pay !== "none" && pay !== "lemonsqueezy") {
    // Stripe + Razorpay on Next.js scaffold their own server routes — the
    // gap there is fulfillment, not plumbing.
    const routeIncluded = s.framework === "nextjs" && (pay === "stripe" || pay === "razorpay");
    gaps.push(
      pay === "revenuecat"
        ? "Payments: connect App Store / Play in the RevenueCat dashboard."
        : platform === "desktop"
          ? "Payments: verify on your server — desktop apps can't hold secret keys."
          : platform === "mobile"
            ? "Payments: verify purchases on your server — never trust the client alone."
            : routeIncluded
              ? "Payments: fulfill orders in the generated route (TODO inside)."
              : "Payments: add a webhook route."
    );
  }
  return gaps;
}

function startHereBody(sel: WizardSelections): string {
  const pm = sel.packageManager;
  const platform: PlatformId = sel.platform ?? "web";
  const catalog = catalogFor(platform);
  const dir = sanitizeAppName(sel.appName, sel);
  const lang = sel.language === "typescript" ? "TypeScript" : "JavaScript";
  const fw = labelOf(catalog.categories.find((c) => c.id === "framework")?.options ?? [], sel.framework);
  const styling = labelOf(catalog.categories.find((c) => c.id === "styling")?.options ?? [], sel.styling);
  const target: "android" | "ios" = sel.target ?? "android";
  const dev = devCommand(pm, platform, sel.framework, target);
  const envFile = envFileFor(sel.framework);
  const services = envBlocks(sel).services;
  const testCmd = testCmdFor(sel);
  const gaps = codeGapsFor(sel, platform);
  // Default dev URL per framework family (web only) — the terminal prints
  // the real one, this is just so a beginner knows where to look.
  const url =
    platform !== "web"
      ? ""
      : sel.framework === "angular"
        ? "http://localhost:4200"
        : ["react-vite", "vue", "solid", "sveltekit"].includes(sel.framework)
          ? "http://localhost:5173"
          : "http://localhost:3000";
  const lines = [
    `# START HERE — ${dir}`,
    "",
    `Your stack: ${fw} + ${lang} + ${styling}, ${pm}${platform === "mobile" ? ` (target: ${target === "ios" ? "iPhone" : "Android"})` : ""}`,
    "Setup is done. Do these in order:",
    "",
    "## 1. Enter your project",
    `Run every command below from inside ${dir}:`,
    "",
    `    cd ${dir}`,
  ];
  if (services.length) {
    lines.push(
      "",
      "## 2. Add your keys",
      `Open ${envFile} — every key is listed with its format and where to find it.`,
      `Needed for: ${services.join(" + ")}.`,
      "Restart the dev server after editing. Never commit this file."
    );
  }
  lines.push(
    "",
    `## ${services.length ? 3 : 2}. Start it`,
    "",
    `    ${dev.command}`,
    "",
    dev.note + (url ? ` (${url}).` : ".")
  );
  if (gaps.length) {
    lines.push("", "## Still needs code", "The script scaffolds — it doesn't write app code:", "");
    for (const g of gaps) lines.push(`- ${g}`);
  }
  lines.push(
    "",
    "## Useful commands",
    `- Dev: ${dev.command}`,
    `- Build: ${buildCmdFor(pm, platform, sel.framework, target)}`,
    ...(testCmd ? [`- Tests: ${testCmd}`] : []),
    ...(sel.toggles["eslint-prettier"] ? [`- Lint: ${pmCommands(pm).pmx} eslint .`] : []),
    "",
    "Regenerate this setup any time at StackWizard — Download .sh again."
  );
  return lines.join("\n");
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
