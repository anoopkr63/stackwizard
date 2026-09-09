"use client";

import { useEffect, useState } from "react";

/* Viewable add-on: appears after scrolling past the hero, smooth-scrolls home. */
export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-lg font-bold shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-ink ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      ↑
    </button>
  );
}
