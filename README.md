# StackWizard — pick your stack, get the exact setup steps

Answer a few questions (platform, framework, database, auth, payments, …) and
StackWizard generates the exact commands, env keys, starter files, and a
`setup.sh` for your scaffold. Share any configuration with a short link.

## Setup & run (this project)

```bash
bun install
bun dev      # http://localhost:3000
bun test
bun run build
bun start
bun run lint
```

Env (optional): copy `.env.example` to `.env` to set `NEXT_PUBLIC_SITE_URL`
(used only for the sitemap canonical URL).

## How it works

- Recipes live in `data/*.json` (`web`, `mobile`, `desktop`, `addons`) —
  never hardcode commands in components.
- `lib/assemble.ts` turns selections into build steps (`assemble`),
  a one-file installer (`buildScript`), and sanitizes the folder name
  (`sanitizeAppName`).
- `lib/share.ts` encodes selections into `?s=` links and short `/s/…` routes.
- `components/Wizard.tsx` renders the questionnaire; `components/Guide.tsx`
  renders the generated guide.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
