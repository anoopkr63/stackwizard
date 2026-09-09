"use client";

import Link from "next/link";
import Reveal from "./Reveal";

export default function Footer() {
  return (
    <footer className="bg-cream px-3 pb-6 pt-14 sm:px-6">
      <Reveal>
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-ember px-6 py-10 text-white sm:px-10 sm:py-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <p className="display shrink-0 text-2xl font-bold leading-none">
              Stack
              <br />
              Wizard
            </p>
            <div className="w-full">
              <form
                className="flex w-full items-center gap-2 rounded-full bg-white/20 p-2 pl-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  document.querySelector("#build")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <label htmlFor="footer-email" className="sr-only">
                  Email for launch updates
                </label>
                <input
                  id="footer-email"
                  type="email"
                  required
                  placeholder="Email for launch news"
                  className="w-full bg-transparent text-base text-white placeholder:text-white/70 focus:outline-none sm:text-lg"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-transform hover:scale-105"
                >
                  Notify me ↗
                </button>
              </form>
              <div className="mt-8 grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
                <div>
                  <p className="font-semibold uppercase tracking-widest text-white/70">Build</p>
                  <ul className="mt-2 space-y-1.5">
                    <li><Link href="#build" className="transition-opacity hover:opacity-75 hover:underline">Web wizard</Link></li>
                    <li><Link href="#examples" className="transition-opacity hover:opacity-75 hover:underline">Presets</Link></li>
                    <li><Link href="#how" className="transition-opacity hover:opacity-75 hover:underline">How it works</Link></li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-widest text-white/70">Learn</p>
                  <ul className="mt-2 space-y-1.5">
                    <li><Link href="#faq" className="transition-opacity hover:opacity-75 hover:underline">Questions</Link></li>
                    <li><span>Docs (soon)</span></li>
                    <li><span>Blog (soon)</span></li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-widest text-white/70">Coming next</p>
                  <ul className="mt-2 space-y-1.5">
                    <li><span>Desktop — Electron, Tauri</span></li>
                    <li><span>More mobile templates</span></li>
                    <li><span>Docker + deploy guides</span></li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-widest text-white/70">Project</p>
                  <ul className="mt-2 space-y-1.5">
                    <li><Link href="#top" className="transition-opacity hover:opacity-75 hover:underline">Back to top</Link></li>
                    <li><span>Free tool · no account</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
      <p className="mx-auto mt-4 max-w-6xl text-xs text-muted">
        © {new Date().getFullYear()} StackWizard.
      </p>
    </footer>
  );
}
