"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-3 z-40 px-3 sm:top-4 sm:px-6">
      <header className="mx-auto max-w-5xl rounded-full border border-line/70 bg-white shadow-[0_12px_32px_-16px_rgba(27,20,13,0.3)]">
        <nav aria-label="Main" className="flex h-14 items-center justify-between gap-2 pl-4 pr-2 sm:pl-5">
          <Link href="#top" className="display flex items-center gap-2 text-lg font-bold">
            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-cream">
              S
            </span>
            <span className="hidden sm:inline">StackWizard</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm font-medium lg:flex">
            <Link href="#how" className="text-muted transition-colors hover:text-ink">
              How it works
            </Link>
            <Link href="#build" className="text-muted transition-colors hover:text-ink">
              Build my stack
            </Link>
            <Link href="#guide" className="text-muted transition-colors hover:text-ink">
              Guide
            </Link>
            <Link href="#examples" className="text-muted transition-colors hover:text-ink">
              Examples
            </Link>
            <Link href="#faq" className="text-muted transition-colors hover:text-ink">
              Questions
            </Link>
          </div>
          <div className="flex items-center">
            <Link
              href="#build"
              className={`anim-cta-glow rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white transition-all duration-500 hover:bg-ember-deep ${
                scrolled ? "px-5" : ""
              }`}
            >
              Start building ↗
            </Link>
          </div>
        </nav>
      </header>
    </div>
  );
}
