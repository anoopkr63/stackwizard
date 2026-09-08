import { Ellipse, SectionEyebrow, SectionSub, SectionTitle } from "./Section";
import Reveal from "./Reveal";

const STEPS = [
  {
    n: "1",
    title: "Tell us what you want",
    body: "Framework, styling, database, login, payments — in plain words.",
  },
  {
    n: "2",
    title: "We order the commands",
    body: "Ordered, deduplicated, numbered.",
  },
  {
    n: "3",
    title: "Copy, paste, run",
    body: "One button copies all. Each line explained.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
      <Reveal>
        <SectionEyebrow>How it works</SectionEyebrow>
        <SectionTitle>
          <Ellipse>Three steps.</Ellipse> No manual. <br />
          No 40-minute video.
        </SectionTitle>
        <SectionSub>
          One dropdown per question. Commands update instantly.
        </SectionSub>
      </Reveal>
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <li className="lift h-full rounded-3xl border-2 border-white bg-white p-6 shadow-[0_18px_40px_-24px_rgba(27,20,13,0.35)]">
              <p className="display text-4xl font-bold text-ember">{s.n}</p>
              <h3 className="display mt-3 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
