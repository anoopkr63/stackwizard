# Original website brief (inspired by reference — do NOT clone)

Create an ORIGINAL website inspired by the structural ideas and interaction patterns of the reference below. The reference is inspiration only. Do not perform a visual one-to-one recreation or make minor modifications to the reference. Create a genuinely new composition appropriate to the brand.
Use the reference to understand the level of art direction, pacing, visual hierarchy, and interaction quality — not to determine the exact appearance of the new site.

## 1. Reference (provenance only — do not copy anything from here)
- URL: https://nomu.store/
- Page type: content/archive page with 40 sections.
- Treat every detail below as an ABSTRACT pattern. Nothing from the source may appear in the output.

## 2. Existing codebase first (read before changing anything)
- Before making changes, inspect the existing codebase, current routes, components, assets, and styling.
- Preserve working functionality and reuse existing components where appropriate.
- Only modify what is necessary to achieve the requested design.

## 3. Your site (fill in EVERY line before running — Patch cannot design an original site without this)
- Brand / site: [YOUR BRAND — e.g. Acme Studio, SaaS analytics]
- Business + audience: [what you do + who it's for]
- Pages: [list your real pages/routes]
- Content: [your projects, campaigns, or posts — titles + 1-line descriptions]
- CTAs: [your real calls to action]
- Assets: [your logo, images, videos — or placeholder specs]
- Tone: [e.g. playful, premium, minimal]

## 4. Content rhythm (loose — adapt counts to YOUR content, never reproduce source density)
Use the following as a loose content rhythm, not a fixed component count. Adapt the number of elements to the actual content and brand.
1. Hero — strong headline, supporting statement, primary CTA.
2. Introduction — concise positioning statement.
3. Supporting content — additional narrative or proof.
4. Archive / library — browsable collection of projects/content.
5. Featured work — visually dominant selected projects.
6. Interactive gallery — visual exploration with restrained interaction.
7. Supporting content — additional narrative or proof.
8. Featured work — visually dominant selected projects.
9. Featured work — visually dominant selected projects.
10. Featured work — visually dominant selected projects.
11. Supporting content — additional narrative or proof.
12. Archive / library — browsable collection of projects/content.
13. Supporting content — additional narrative or proof.
14. Supporting content — additional narrative or proof.
15. Next-section teaser + footer.
These 15 items are a suggested storytelling rhythm, not a requirement to create exactly 15 sections. Combine, remove, or introduce sections when needed to serve the actual content and brand.

## 5. Interaction patterns to reinterpret (rebuild the IDEA, not the implementation)
- clear CTAs with hover/focus states.
- carousel with prev/next arrows.
- filterable / browsable archive index.
- expandable accordions.
- forms with validation states.
- smooth scrolling + subtle restrained transitions.

## 6. Reference measurements (level only — define YOUR OWN tokens, do not paste these values)
- Source fonts: Inter, ui-sans-serif, ui-monospace.
- Source scale: H1 60px / H2 48px / H3 30px / body ~16px — match the SENSE of scale with fluid mobile type, not the numbers.
- Your font slots: display = [YOUR DISPLAY FONT — e.g. a premium grotesque/serif loaded via Google Fonts or @font-face, weights 500–700] + body = [YOUR BODY FONT — highly legible, weights 400–600]. Wire both as CSS variables (e.g. --font-display / --font-body) with system fallbacks; fluid clamp() sizes.
- Source palette: backgrounds #ff7448, #fff9f6, #22c55e, #0f151d, #1a1a1a, #ffef46 | text #0f151d, #000000, #ffffff, #fbfbfb — read contrast/feel only, then define your own palette + 1 accent.
- Source radius: 2.68435e+07px | elevation: soft shadows on cards/overlays | layout: mostly flex.
- Source media volume (reference-only): ~164 image(s) — observed aspect ratios: 1:1 (32×32), 108×14, 1:1 (16×16), 46×33, 1:1 (20×20), 1:1 (21×21). Use the amount, placement, and aspect ratios that best fit YOUR content and the new composition. Do not reproduce the source media count or dimensions.
- Source responsive: 1945px reference (captured at 1960×912); viewport meta "width=device-width, initial-scale=1, viewport-fit=cover"; CSS min-width breakpoints: none detected; matched now: ≥360px, ≥768px, ≥1024px, ≥1280px; sticky/fixed headers: yes.
- Source motion: 8 distinct animation(s) ~2.4s, 1s, 4.2s, 3.8s (linear, ease-in-out, 0); transitions on all, opacity, transform, translate, scale ~0s, 0.3s, 0.5s, 0.15s; smooth scrolling: yes (smooth). Match the FEEL with your own keyframes/easings — do not copy keyframe names.

## 7. Design principles
- Editorial / premium feel: very large display type + small supporting text, generous whitespace.
- Image/video-led storytelling; preserve an unusual visual rhythm, not generic cards.
- Motion: smooth, subtle, restrained.
- Do not use a generic AI-generated website aesthetic: avoid repetitive card grids, excessive rounded corners, excessive gradients, floating glassmorphism cards, unnecessary shadows, or template-like sections.

## 8. Do NOT copy from the source
- Brand name, logo, campaign/project names, awards, testimonials.
- Exact marketing copy, headings, navigation labels.
- Images, videos, icons, URLs, assets.
- Exact colors, fonts, sizes, spacing, layout, animations, DOM structure.
- If any output resembles the source beyond generic structure, regenerate it.

## 9. Priority order
- Visual hierarchy → layout/composition → typography → spacing → imagery → interactions → animation → technical polish.

## 10. Responsive + review
- Support responsive layouts from 360px through large desktop widths (~1945px+); use 360 / 768 / 1024 / 1280px as QA checkpoints. Fluid type; no horizontal scroll on mobile.
- After implementation, review the result at 360px, 768px, 1024px, and 1280px. Fix overflow, spacing, typography, alignment, broken interactions, and responsive inconsistencies before considering the task complete.

## 11. Accessibility
- Use semantic HTML, keyboard-accessible controls, visible focus states, sufficient contrast, meaningful alt text, and respect `prefers-reduced-motion`.

## 12. SEO basics
- Unique <title> + meta description per page, OG tags, favicon, sitemap.xml, permissive robots.txt.

## 13. Build instructions
1. Inspect the existing codebase first (§2) and reuse what works.
2. Fill in §3 with the user's real brand/content — never invent fake client work or copy source content.
3. Scaffold the rhythm in §4 with YOUR content and §5 interactions, following the priority in §9.
4. Define YOUR tokens using §6 only as a level reference; never paste source values. Load YOUR display + body fonts (§6) with system fallbacks and clamp() fluid sizes.
5. Use placeholder image/video slots appropriate to the new design and actual content: choose aspect ratios from the composition, not the reference; stable aspect-ratio containers; lazy loading for images; meaningful original alt text; no layout shift. Videos get appropriate poster frames and accessible controls. Do not use source URLs or source assets.
6. Responsive + review per §10, accessibility per §11, SEO per §12.
7. Output clean, commented code plus a list of original decisions you made and what you reviewed.