import Link from "next/link";
import Reveal from "./Reveal";

const STATS: [string, string][] = [
  ["7", "frameworks"],
  ["7", "add-on groups"],
  ["3", "one-click presets"],
];

export default function Closing() {
  return (
    <>
      {/* layered wave divider into the dark band */}
      <div aria-hidden="true" className="bg-cream">
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="block h-[54px] w-full sm:h-[84px]">
          <path
            d="M0,52 C240,84 420,8 720,36 C1020,64 1200,18 1440,50 L1440,90 L0,90 Z"
            fill="var(--color-ember)"
            opacity="0.55"
          />
          <path
            d="M0,62 C260,90 460,22 740,48 C1020,74 1220,30 1440,60 L1440,90 L0,90 Z"
            fill="var(--color-night)"
          />
        </svg>
      </div>
      <section className="relative overflow-hidden bg-night text-cream">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="anim-blob-warm absolute -bottom-32 left-[15%] h-72 w-72 rounded-full bg-ember/20 blur-[64px]" />
          <div className="anim-blob-cool absolute -top-24 right-[10%] h-64 w-64 rounded-full bg-ember/10 blur-[64px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:py-20">
          <Reveal>
            <h2 className="display mx-auto max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
              You&apos;re the architect.
              <br />
              We&apos;re the <span className="text-ember">instructions.</span>
            </h2>
            <Link
              href="#build"
              className="anim-cta-glow mt-7 inline-block rounded-full bg-ember px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-ember-deep"
            >
              Build my stack now
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-4">
              {STATS.map(([n, label]) => (
                <div key={label}>
                  <p className="display text-5xl font-medium sm:text-6xl">{n}</p>
                  <p className="mt-1 font-mono text-sm text-white/60">{label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
