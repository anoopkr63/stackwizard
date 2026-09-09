import Link from "next/link";
import Reveal from "./Reveal";
import TwinkleField from "./TwinkleField";

const TAKEAWAYS = [
  "Terminal commands",
  "setup.sh in one click",
  "Shareable link",
  "AI rules included",
];

export default function Closing() {
  return (
    <>
      {/* wave divider into the dark band — solid ember crest, no translucent wash */}
      <div aria-hidden="true" className="bg-cream">
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="-mb-px block h-[54px] w-full sm:h-[84px]">
          <path
            d="M0,54 C260,82 460,14 740,40 C1020,66 1220,22 1440,52 L1440,90 L0,90 Z"
            fill="var(--color-ember)"
          />
          <path
            d="M0,62 C260,90 460,22 740,48 C1020,74 1220,30 1440,60 L1440,90 L0,90 Z"
            fill="var(--color-night)"
          />
        </svg>
      </div>
      <section className="relative overflow-hidden bg-night text-cream">
        <TwinkleField />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="anim-blob-warm absolute -bottom-32 left-[15%] h-72 w-72 rounded-full bg-ember/20 blur-[64px]" />
          <div className="anim-blob-cool absolute -top-24 right-[10%] h-64 w-64 rounded-full bg-ember/10 blur-[64px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:py-20">
          <Reveal>
            <p className="inline-block rounded-full border border-white/20 px-3 py-1 font-mono text-xs uppercase tracking-widest text-white/70">
              Ready when you are
            </p>
            <h2 className="display mx-auto mt-4 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
              Copy. Paste. <span className="text-ember">Running.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/70">
              Every pick becomes terminal commands, a one-file setup script, and a link you can share.
            </p>
            <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2">
              {TAKEAWAYS.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-cream"
                >
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href="#build"
              className="anim-cta-glow mt-8 inline-block rounded-full bg-ember px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-ember-deep"
            >
              Build my stack now
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
