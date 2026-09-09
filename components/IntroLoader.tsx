"use client";

import { useEffect, useState } from "react";

/* Nomu-style intro loader phrases, stack-flavored */
const PHRASES = [
  "Resolving dependencies…",
  "Ordering commands…",
  "Checking add-on combos…",
  "Explaining each line…",
  "Warming up the wizard…",
];

export default function IntroLoader() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [phrase, setPhrase] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (sessionStorage.getItem("sw-intro-seen")) return;
    } catch {
      return; // storage blocked (private mode) — skip the intro, not the page
    }
    // Mount-only client init: window/sessionStorage don't exist during SSR,
    // so this can't move into a state initializer without a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    const phraseTimer = window.setInterval(
      () => setPhrase((p) => (p + 1) % PHRASES.length),
      360
    );
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1500);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem("sw-intro-seen", "1");
      } catch {
        /* best-effort */
      }
    }, 1900);
    return () => {
      window.clearInterval(phraseTimer);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      id="nomu-intro-loader"
      role="status"
      aria-label="Loading StackWizard"
      className={`fixed inset-0 z-[60] grid place-items-center bg-cream transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* warm / cool blobs — exact 8s / 9s reference timing */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="anim-blob-warm absolute -top-24 left-[12%] h-72 w-72 rounded-full bg-ember/15 blur-[64px]" />
        <div className="anim-blob-cool absolute bottom-[10%] right-[8%] h-80 w-80 rounded-full bg-ember/10 blur-[64px]" />
      </div>
      <div className="relative text-center">
        <p
          className="display mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink text-xl font-bold text-cream"
          style={{ animation: "intro-logo-in 0.5s ease-out both" }}
        >
          S
        </p>
        <p
          key={phrase}
          className="mt-4 font-mono text-sm text-muted"
          style={{ animation: "intro-reel-fade 1.5s ease-out both" }}
        >
          {PHRASES[phrase]}
        </p>
      </div>
    </div>
  );
}
