import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://stackwizard.example.com"),
  title: "StackWizard — pick your stack, get the exact setup steps",
  description:
    "Answer a few plain questions about your project. StackWizard writes the terminal commands in the right order, with a one-line explanation for each.",
  openGraph: {
    title: "StackWizard — pick your stack, get the exact setup steps",
    description:
      "Answer a few plain questions. Get copy-paste terminal commands in the right order, each explained in one line.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "StackWizard — pick your stack, get the exact setup steps" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StackWizard — pick your stack, get the exact setup steps",
    description:
      "Answer a few plain questions. Get copy-paste terminal commands in the right order, each explained in one line.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
