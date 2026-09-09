"use client";

import Link from "next/link";
import web from "@/data/web.json";
import mobile from "@/data/mobile.json";
import desktop from "@/data/desktop.json";
import ChipScatter from "./ChipScatter";
import TwinkleField from "./TwinkleField";
import { useSelection } from "./SelectionProvider";

const FRAMEWORKS = [
  ...(web.categories.find((c) => c.id === "framework")?.options.map((o) => o.label) ?? []),
  ...(mobile.categories.find((c) => c.id === "framework")?.options.map((o) => o.label) ?? []),
  ...(desktop.categories.find((c) => c.id === "framework")?.options.map((o) => o.label) ?? []),
];

export default function Hero() {
  // Terminal card mirrors the live app folder from the wizard below.
  const { dir } = useSelection();
  const preview = [`npm create next-app@latest ${dir}`, `cd ${dir}`, "npm install", "npm run dev"];
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="anim-blob-warm absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-ember/15 blur-[64px]" />
        <div className="anim-blob-cool absolute top-32 right-[4%] h-80 w-80 rounded-full bg-ember/10 blur-[64px]" />
      </div>

      {/* scattered chips (desktop only — they need room to breathe) */}
      <ChipScatter />
      {/* twinkling stars — exact swp-twinkle reference timing */}
      <TwinkleField />

      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:px-6 lg:pt-24">
        <p
          className="anim-hero inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted"
          style={{ animationDelay: "0ms" }}
        >
          Free tool for developers · Web + Mobile + Desktop
        </p>
        <h1
          className="anim-hero display mx-auto mt-6 max-w-4xl text-[clamp(2.6rem,7vw,4.75rem)] font-bold leading-[1.04]"
          style={{ animationDelay: "90ms" }}
        >
          Pick your stack.
          <br />
          Get the exact{" "}
          <span className="hl-pill">
            setup steps
            <span aria-hidden="true" className="anim-twinkle text-ember">
              {" "}✦
            </span>
          </span>
        </h1>
        <div
          className="anim-hero mt-8 flex flex-wrap justify-center gap-3"
          style={{ animationDelay: "270ms" }}
        >
          <Link
            href="#build"
            className="anim-cta-glow rounded-full bg-ember px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-ember-deep"
          >
            Build my stack
          </Link>
          <Link
            href="#how"
            className="rounded-full border border-ink/20 bg-white px-7 py-3.5 text-base font-semibold transition-colors hover:border-ink"
          >
            See how it works
          </Link>
        </div>

        {/* terminal card */}
        <div
          aria-label="Example of generated commands"
          className="anim-hero anim-float mx-auto mt-12 max-w-2xl rounded-2xl bg-night p-2 text-left shadow-xl"
          style={{ animationDelay: "360ms" }}
        >
          <div className="flex items-center gap-1.5 px-3 py-2" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="ml-2 font-mono text-xs text-white/50">terminal — your new project</span>
          </div>
          <div className="rounded-xl bg-night-soft p-4 font-mono text-[13px] leading-7 text-white/90 sm:text-sm">
            {preview.map((line) => (
              <p key={line}>
                <span aria-hidden="true" className="mr-2 select-none text-ember">
                  $
                </span>
                {line}
              </p>
            ))}
            <p className="mt-2 text-white/50"># each line explained below ↓</p>
          </div>
        </div>
      </div>

      {/* framework marquee — 4 identical sets so the -50% loop always has
          content under the viewport (1 set alone is narrower than wide screens) */}
      <div className="marquee overflow-hidden border-t border-line bg-parchment py-3" aria-label="Supported frameworks">
        <div className="marquee-track flex w-max items-center gap-8 pr-8 will-change-transform">
          {Array.from({ length: 4 })
            .flatMap(() => FRAMEWORKS)
            .map((f, i) => (
              <span
                key={`${f}-${i}`}
                aria-hidden={i >= FRAMEWORKS.length || undefined}
                className="display flex items-center gap-8 text-sm font-semibold text-muted"
              >
                {f}
                <span aria-hidden="true" className="text-ember">✦</span>
              </span>
            ))}
        </div>
      </div>
    </section>
  );
}
