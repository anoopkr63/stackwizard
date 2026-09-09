import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How StackWizard handles your information: what is stored, what is not, and how to reach us.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        <Link href="/" className="display text-lg font-bold">
          StackWizard
        </Link>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <p className="font-mono text-sm text-muted">Last updated: September 2026</p>
        <h1 className="display mt-2 text-4xl font-bold">Privacy</h1>
        <div className="mt-6 space-y-5 text-base leading-relaxed">
          <p>
            StackWizard is a free tool with no account. Your wizard selections
            stay in your browser and in the page address when you share a setup.
            We do not run analytics, advertising trackers, or user profiles.
          </p>
          <h2 className="display pt-2 text-xl font-bold">What we store</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Nothing from the wizard itself. There is no database of projects,
              names, or commands.
            </li>
            <li>
              If you enter your email for launch news, it is sent once to the
              site owner through the form provider so you can be notified. That
              is the only personal data we receive.
            </li>
          </ul>
          <h2 className="display pt-2 text-xl font-bold">What others may store</h2>
          <p>
            The site is hosted on Vercel, which keeps standard server logs
            (such as IP address and request time) to operate and protect the
            service. The launch-news form is delivered by FormSubmit. Their own
            policies apply to that one email submission.
          </p>
          <h2 className="display pt-2 text-xl font-bold">Your choices</h2>
          <p>
            Do not enter your email if you do not want launch news. To remove an
            address you already submitted, write to{" "}
            <a
              href="mailto:anoopkr6300@gmail.com"
              className="font-medium underline underline-offset-4"
            >
              anoopkr6300@gmail.com
            </a>{" "}
            with the subject “Delete my email” and it will be deleted.
          </p>
          <h2 className="display pt-2 text-xl font-bold">Contact</h2>
          <p>
            Questions about this page:{" "}
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
