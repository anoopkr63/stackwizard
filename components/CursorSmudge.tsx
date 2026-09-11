"use client";

import { useEffect, useRef } from "react";

// Ambient cursor smudge — a soft ember aura that follows the mouse 1:1,
// visible only over the hero section. Fades out anywhere else, including
// over the hero's own inputs, buttons and links.
const HERO_SELECTOR = "#hero";
const INTERACTIVE_SELECTOR =
  'input, textarea, select, button, a, pre, code, [role="button"], [data-smudge-hide]';

export default function CursorSmudge() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let visible = false;
    const setVisible = (v: boolean) => {
      if (v === visible) return;
      visible = v;
      el.style.opacity = v ? "1" : "0";
    };

    const onMove = (e: MouseEvent) => {
      // Direct set — no easing loop, so the smudge never lags the cursor.
      el.style.transform = `translate3d(${e.clientX - 160}px, ${e.clientY - 160}px, 0)`;
      const t = e.target as HTMLElement | null;
      setVisible(!!t?.closest(HERO_SELECTOR) && !t?.closest(INTERACTIVE_SELECTOR));
    };
    const onLeave = () => setVisible(false);

    // Boundary listeners fire the instant the pointer crosses the hero
    // edge — no waiting for the next mousemove in the other section.
    const hero = document.querySelector(HERO_SELECTOR);
    const onHeroLeave = () => setVisible(false);
    hero?.addEventListener("mouseleave", onHeroLeave);

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      hero?.removeEventListener("mouseleave", onHeroLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-30 h-80 w-80 rounded-full opacity-0 transition-opacity duration-150"
      style={{
        background:
          "radial-gradient(circle, rgba(232, 80, 26, 0.16) 0%, rgba(232, 80, 26, 0.07) 40%, transparent 70%)",
      }}
    />
  );
}
