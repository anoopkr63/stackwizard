import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms for using StackWizard: what the tool is, what it is not, and where responsibility lies.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        <Link href="/" className="display text-lg font-bold">
          StackWizard
        </Link>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <p className="font-mono text-sm text-muted">Last updated: September 2026</p>
        <h1 className="display mt-2 text-4xl font-bold">Terms</h1>
        <div className="mt-6 space-y-5 text-base leading-relaxed">
          <p>
            StackWizard gives you terminal commands for common project setups,
            each with a one-line explanation. Use of the site means you accept
            these terms.
          </p>
          <h2 className="display pt-2 text-xl font-bold">What you get</h2>
          <p>
            The output is general guidance, not advice for your specific system.
            Commands can behave differently across operating systems, versions,
            and existing files. Read each step before you run it.
          </p>
          <h2 className="display pt-2 text-xl font-bold">Your responsibility</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>You run commands on your own machine at your own risk.</li>
            <li>Back up work you care about before running new commands.</li>
            <li>Do not use the tool for anything unlawful or harmful.</li>
          </ul>
          <h2 className="display pt-2 text-xl font-bold">Availability and cost</h2>
          <p>
            The tool is free and provided as is, without warranties. It may
            change or stop working at any time. We are not liable for loss
            caused by using the output.
          </p>
          <h2 className="display pt-2 text-xl font-bold">Contact</h2>
          <p>
            Questions about these terms:{" "}
            <a
              href="mailto:anoopkr6300@gmail.com"
              className="font-medium underline underline-offset-4"
            >
              anoopkr6300@gmail.com
            </a>
            .
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
