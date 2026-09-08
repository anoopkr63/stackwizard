import { SectionEyebrow, SectionSub, SectionTitle } from "./Section";
import Reveal from "./Reveal";

const ITEMS = [
  {
    title: "Find the right pieces",
    body: "Only combos that work. Bad picks stay hidden.",
  },
  {
    title: "Always in the right order",
    body: "Sorted, deduplicated, numbered.",
  },
  {
    title: "Plain explanations included",
    body: "One plain sentence under each command.",
  },
  {
    title: "Share your exact stack",
    body: "One link holds all your choices.",
  },
];

export default function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <Reveal>
        <SectionEyebrow>Why it helps</SectionEyebrow>
        <SectionTitle>You decide. We handle the ordering.</SectionTitle>
        <SectionSub>Just the correct commands, explained.</SectionSub>
      </Reveal>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {ITEMS.map((f, i) => (
          <Reveal key={f.title} delay={(i % 2) * 90}>
            <article className="lift h-full rounded-3xl border-2 border-white bg-white p-6 shadow-[0_18px_40px_-24px_rgba(27,20,13,0.35)]">
              <h3 className="display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{f.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
