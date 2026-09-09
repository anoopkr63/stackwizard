"use client";

import { useState } from "react";
import { SectionEyebrow, SectionTitle } from "./Section";
import Reveal from "./Reveal";
import { useSelection } from "./SelectionProvider";

const FAQS = [
  {
    q: "Do I need to know the terminal already?",
    a: "No. Every box starts blank — answer only what you need. Then hover any numbered block, hit Copy, and paste it into Terminal (Mac) or Git Bash (Windows) and press Enter. “What each step does” labels every line, and only the final line keeps running — everything before it finishes and exits.",
  },
  {
    q: "What is the smallest thing I can start with?",
    a: "TypeScript + React (Vite) + Plain CSS + npm, everything else left blank — about four commands and one project folder. Add extras later by answering more boxes; the page regenerates the full sequence around what you already have.",
  },
  {
    q: "How long does the full setup take?",
    a: "A simple stack runs in about five minutes, mostly downloading. A full stack with backend, database, login, and payments takes around twenty — install time, not typing time. Download .sh runs it unattended; only the last line stays on to serve your app.",
  },
  {
    q: "What if I pick the wrong option?",
    a: "Change the dropdown and the commands regenerate instantly — nothing is installed by choosing. Hit Copy share link and the address holds that exact setup, so no pick is permanent. Incompatible pairs (Mongoose without MongoDB, Supabase Auth with Firebase) go blank automatically.",
  },
  {
    q: "Does StackWizard touch my machine or need my passwords?",
    a: "Never. This site generates text; every command runs on your machine, by you. API keys go into the .env file the steps create locally — the steps also add it to .gitignore, so it stays yours, uncommitted, unsent. The generated AI rules even order assistants never to print it.",
  },
  {
    q: "It says “Could not read package.json” (ENOENT). What went wrong?",
    a: "You ran an install from the wrong folder — almost always before cd my-app. Check pwd ends in my-app, cd into it, and re-run just the failed line. If setup.sh died halfway, delete the partial folder (rm -rf my-app) and start over.",
  },
  {
    q: "What does it cost?",
    a: "StackWizard is free, and everything it installs starts free — Supabase, Firebase, Clerk, and the rest all have free tiers. The only paid moments belong to the tools themselves: Stripe and Razorpay need real accounts to accept live money, but test keys carry you through all of development.",
  },
];

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="display flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-lg font-medium"
      >
        {q}
        <span
          aria-hidden="true"
          className={`shrink-0 text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ⌄
        </span>
      </button>
      <div className={`acc-panel ${open ? "open" : ""}`}>
        <div className="acc-inner">
          <p className="max-w-2xl pb-6 leading-relaxed text-muted">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function Faq() {
  // The troubleshooting answer names the live app folder from the wizard.
  const { dir } = useSelection();
  return (
    <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
      <Reveal>
        <SectionEyebrow>Questions</SectionEyebrow>
        <SectionTitle>
          You got questions? <span className="text-ember">We got answers.</span>
        </SectionTitle>
      </Reveal>
      <div className="mt-4 border-t border-ink/10">
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={Math.min(i, 3) * 60}>
            <Item q={f.q} a={f.a.replaceAll("my-app", dir)} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
