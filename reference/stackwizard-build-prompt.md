# Build Prompt: "StackWizard" — Universal Boilerplate Command Generator

Copy everything below into Claude Code (or another AI coding assistant) to start building.

---

## Project Overview

Build a public web app called **StackWizard** that helps developers scaffold new projects across **Web, Mobile, and Desktop** platforms. The user picks their preferences from a series of dropdowns (framework, language, styling, database, auth, payments, testing, CI/CD, etc.), and the app outputs a **ready-to-run sequence of terminal commands** to set up that exact stack locally — plus a short explanation of what each command does.

This is NOT a code generator that produces files. It is a **command/recipe wizard**: each choice maps to a stored snippet (a CLI command, an npm install line, or a short setup note), and the app assembles the full sequence in the correct order based on all selections.

## Tech Stack (for building the app itself)

- Next.js (App Router) + TypeScript
- Tailwind CSS for styling
- Data-driven architecture: all snippets/recipes live in structured JSON files (not hardcoded in components), so new platforms/tools can be added without touching UI code
- Deploy target: Vercel

## Core Architecture

1. **Data layer**: `/data/*.json` files, one per platform (web.json, mobile.json, desktop.json) plus `addons.json` for cross-cutting options (auth, payments, testing, CI/CD, package manager, linting). Each entry has: `id`, `label`, `category`, `commands: string[]`, `notes?: string`, `dependsOn?: string[]` (for conditional logic, e.g. ORM options depend on which database was picked).
2. **Wizard UI**: multi-step or single-page form with conditional dropdowns — selecting "Mobile" hides web-only categories like "Styling" and shows mobile-only ones like "Expo vs bare React Native."
3. **Command assembler**: a function that takes all current selections and outputs an ordered array of shell commands, deduplicated and correctly sequenced (e.g. `cd` into the project before running install commands).
4. **Output panel**: syntax-highlighted code block, "Copy all" button, and a plain-English numbered explanation underneath.

## Feature Requirements — Phase 1 (build this first)

Scope: **Web platform only**, to prove out the pattern end-to-end.

Dropdowns/categories for Web:
- Language: JavaScript / TypeScript
- Framework: React (Vite), Next.js, Vue, Nuxt, Svelte/SvelteKit, Angular, SolidJS
- Styling: Tailwind CSS, CSS Modules, styled-components, plain CSS/SCSS
- Package manager: npm, yarn, pnpm, bun
- Linting/formatting: ESLint + Prettier (toggle), Husky pre-commit hook (toggle)

Add-ons (checkboxes, apply after framework is chosen):
- Backend: none, Express, NestJS, FastAPI, Django, Laravel, Go (Gin), Rails
- Database: none, PostgreSQL, MySQL, MongoDB, SQLite, Supabase, Firebase
- ORM: (only shown if a SQL/NoSQL DB is picked) Prisma, Drizzle, TypeORM, Mongoose
- Auth: none, Auth.js/NextAuth, Clerk, Auth0, Firebase Auth, Supabase Auth
- Payments: none, Stripe, PayPal, Paddle, LemonSqueezy, Razorpay
- Testing: none, Jest, Vitest, Playwright, Cypress
- CI/CD: none, GitHub Actions, GitLab CI

Behavior:
- Selections update a live preview of the command block in real time
- "Generate" produces the final formatted output with copy button
- Include a short human-readable note under each command explaining what it does (important for beginners)

## Phase 2 (after Phase 1 works)

Deepen Web: add Docker setup, monorepo tooling (Turborepo/Nx), environment variable templates (.env scaffolding instructions), deployment notes (Vercel/Netlify/Docker).

## Phase 3

Add **Mobile** platform: React Native (Expo / bare), Flutter, native iOS (Swift/Xcode), native Android (Kotlin), Ionic — with mobile-specific add-ons (Detox for testing, mobile push notification setup, app store build commands).

## Phase 4

Add **Desktop** platform: Electron, Tauri, .NET MAUI, Flutter Desktop, Qt — each split further by target OS (Windows/macOS/Linux) since build/setup commands differ per OS.

## Phase 5 — Polish & Growth Features

- Shareable URL for a generated stack (encode selections in query params so users can share "here's my exact stack" links)
- One-click popular presets: T3 Stack, MERN, JAMstack, Flutter + Firebase, MEAN, etc.
- Search/filter within long dropdowns
- Optional accounts to save favorite stacks
- Dark/light mode

## Design Notes

- Keep the UI clean and wizard-like: group dropdowns into clear sections (Platform → Core Framework → Styling → Backend/Data → Add-ons)
- Conditional rendering is critical — never show irrelevant options for the chosen platform
- Command output should look like a real terminal (monospace font, dark background, copy button top-right)
- Mobile-responsive since developers will share links to this

## First Task

Start with Phase 1 only. Scaffold the Next.js + TypeScript + Tailwind project, build the data schema for `web.json`, build the wizard form with conditional dropdowns for the Web category list above, and implement the command assembler + output panel. Do not build Mobile or Desktop yet.
