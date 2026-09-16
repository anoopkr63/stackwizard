import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StackWizard — pick your stack, get the exact setup steps",
    short_name: "StackWizard",
    description:
      "Answer a few plain questions. Get copy-paste terminal commands in the right order, each explained in one line.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8f1",
    theme_color: "#fff8f1",
    icons: [
      // Installability needs a real 192 and a real 512 — the old single entry
      // declared 512x512 but shipped a 1254px, 1.1 MB file.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
  };
}
