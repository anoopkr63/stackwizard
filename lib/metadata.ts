import type { Metadata } from "next";
import { siteName } from "./site";

// Next.js merges metadata from layout down to page **shallowly**: a page that
// sets `openGraph` replaces the root object entirely, and a page that sets
// nothing inherits the root's title/description verbatim. Both halves of that
// rule bite here — without this helper every subpage shipped the homepage's
// OG card and no og:url at all.
//
// So each page spells out a complete openGraph/twitter block, and this is the
// one place the shared parts (site name, type, locale, image) are written.

const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "StackWizard — pick your stack, get the exact setup steps",
};

/** Matches `title.template` in app/layout.tsx, which OG tags do not inherit. */
function ogTitle(title: string): string {
  return `${title} · ${siteName}`;
}

export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  /** Root-relative, e.g. "/contact" — resolved against metadataBase. */
  path: string;
}): Metadata {
  const full = ogTitle(title);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      siteName,
      title: full,
      description,
      url: path,
      type: "website",
      locale: "en_US",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

/** The homepage keeps its own wording; it only needs the shared image + url. */
export const homeOpenGraphImage = OG_IMAGE;
