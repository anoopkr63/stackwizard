"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-ink">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
          <p className="font-mono text-sm text-muted">Something went wrong</p>
          <h1 className="display mt-2 text-4xl font-bold leading-tight sm:text-5xl">
            The page failed to load.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            This is usually temporary. Try again — nothing you typed is sent
            anywhere, so there is nothing to lose.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
            >
              Back to home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
