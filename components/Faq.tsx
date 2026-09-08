"use client";

import { useState } from "react";
import { SectionEyebrow, SectionTitle } from "./Section";
import Reveal from "./Reveal";

const FAQS = [
  {
    q: "Do I need to know the terminal already?",
    a: "Copy, paste, Enter. Each line says what it does.",
  },
  {
    q: "What is the smallest thing I can start with?",
    a: "TypeScript + React (Vite) + Plain CSS + npm. 4 lines.",
  },
  {
    q: "How long does the full setup take?",
    a: "Simple: 5 min. Full stack: ~20 min.",
  },
  {
    q: "What if I pick the wrong option?",
    a: "Nothing breaks. Change it, copy again.",
  },
  {
    q: "Does StackWizard write files or need my passwords?",
    a: "No. Keys stay in your own .env file.",
  },
  {
    q: "It says “Could not read package.json” (ENOENT). What went wrong?",
    a: "Wrong folder. Run cd my-app first.",
  },
  {
    q: "What does it cost? Is there a minimum?",
    a: "Free. Some suggested tools have paid plans.",
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
            <Item q={f.q} a={f.a} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
