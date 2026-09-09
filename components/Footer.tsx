"use client";

import { useState } from "react";
import Link from "next/link";
import Reveal from "./Reveal";

// TODO: replace with your inbox — FormSubmit sends a one-time activation
// email there, then every Notify-me signup lands in that inbox. Free, no account.
const NOTIFY_EMAIL = "you@example.com";

type Status = "idle" | "sending" | "done" | "error";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(NOTIFY_EMAIL)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, _subject: "StackWizard launch signup" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

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
              {status === "done" ? (
                <p role="status" className="rounded-full bg-white/20 px-6 py-4 text-base text-white sm:text-lg">
                  You&apos;re in! Watch your inbox for launch news.
                </p>
              ) : (
                <form
                  className="flex w-full items-center gap-2 rounded-full bg-white/20 p-2 pl-6"
                  onSubmit={subscribe}
                >
                  <label htmlFor="footer-email" className="sr-only">
                    Email for launch updates
                  </label>
                  <input
                    id="footer-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === "sending"}
                    placeholder="Email for launch news"
                    className="w-full bg-transparent text-base text-white placeholder:text-white/70 focus:outline-none disabled:opacity-60 sm:text-lg"
                  />
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {status === "sending" ? "Saving…" : "Notify me ↗"}
                  </button>
                </form>
              )}
              {status === "error" && (
                <p role="alert" className="mt-2 pl-6 text-sm text-white">
                  Couldn&apos;t save that — check your connection and try again.
                </p>
              )}
              <div className="mt-8 grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
                <div>
                  <p className="font-semibold uppercase tracking-widest text-white/70">Build</p>
                  <ul className="mt-2 space-y-1.5">
                    <li><Link href="#build" className="transition-opacity hover:opacity-75 hover:underline">Build my stack</Link></li>
                    <li><Link href="#examples" className="transition-opacity hover:opacity-75 hover:underline">Presets</Link></li>
                    <li><Link href="#how" className="transition-opacity hover:opacity-75 hover:underline">How it works</Link></li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-widest text-white/70">Learn</p>
                  <ul className="mt-2 space-y-1.5">
                    <li><Link href="#guide" className="transition-opacity hover:opacity-75 hover:underline">Guide</Link></li>
                    <li><Link href="#faq" className="transition-opacity hover:opacity-75 hover:underline">Questions</Link></li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-widest text-white/70">Platforms</p>
                  <ul className="mt-2 space-y-1.5">
                    <li><Link href="#build" className="transition-opacity hover:opacity-75 hover:underline">Web</Link></li>
                    <li><Link href="#build" className="transition-opacity hover:opacity-75 hover:underline">Mobile</Link></li>
                    <li><Link href="#build" className="transition-opacity hover:opacity-75 hover:underline">Desktop</Link></li>
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
