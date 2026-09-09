import type { Metadata } from "next";
import Link from "next/link";
import { siteEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to reach StackWizard: report a wrong command, a broken link, or ask a question.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        <Link href="/" className="display text-lg font-bold">
          StackWizard
        </Link>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="display text-4xl font-bold">Contact</h1>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
          Found a command that is wrong, a link that is broken, or a setup that
          should be covered? Send a short note with what you picked and what
          you expected.
        </p>
        <div className="mt-8 rounded-3xl border border-line bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">
            Email
          </p>
          <a
            href={`mailto:${siteEmail}?subject=${encodeURIComponent("StackWizard feedback")}`}
            className="display mt-2 block text-2xl font-bold underline-offset-4 hover:underline"
          >
            {siteEmail}
          </a>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Include the page address if your message is about a shared setup —
            the selections are encoded in the link, which makes the problem easy
            to reproduce.
          </p>
        </div>
        <p className="mt-10">
          <Link href="/" className="text-sm font-semibold underline underline-offset-4">
            Back to the home page
          </Link>
        </p>
      </main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-8 text-xs text-muted sm:px-6">
        © {new Date().getFullYear()} StackWizard.
      </footer>
    </div>
  );
}
