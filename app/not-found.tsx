import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you asked for does not exist. Start over from the StackWizard home page.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <header className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6">
        <Link href="/" className="display text-lg font-bold">
          StackWizard
        </Link>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <p className="font-mono text-sm text-muted">404</p>
        <h1 className="display mt-2 text-4xl font-bold leading-tight sm:text-5xl">
          This page does not exist.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
          The link may be old, or the address was typed wrong. The tool itself
          is on the home page — your selections are kept in the address bar, so
          shared links still work from there.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
          >
            Go to the home page
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
          >
            Report a broken link
          </Link>
        </div>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-xs text-muted sm:px-6">
        © {new Date().getFullYear()} StackWizard.
      </footer>
    </div>
  );
}
