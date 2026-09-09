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
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
  };
}
