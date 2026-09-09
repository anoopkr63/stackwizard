"use client";

import { useState } from "react";
import { SectionEyebrow, SectionSub, SectionTitle } from "./Section";
import Reveal from "./Reveal";
import { useSelection } from "./SelectionProvider";

function Code({ lines, label }: { lines: string[]; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative mt-4">
      <pre className="overflow-x-auto rounded-xl bg-night p-4 pr-20 font-mono text-sm leading-relaxed text-cream">
        {lines.map((l) => (
          <span key={l} className="block">
            <span aria-hidden="true" className="mr-2 text-ember">
              $
            </span>
            {l}
          </span>
        ))}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy: ${label}`}
        className="absolute right-2 top-2 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-cream transition-colors hover:bg-white/20"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const card =
  "lift h-full rounded-3xl border-2 border-white bg-white p-6 shadow-[0_18px_40px_-24px_rgba(27,20,13,0.35)]";

export default function Guide() {
  // Examples mirror the live app folder from the wizard above.
  const { dir } = useSelection();
  return (
    <section id="guide" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
      <Reveal>
        <SectionEyebrow>Field guide</SectionEyebrow>
        <SectionTitle>From commands to a running app.</SectionTitle>
        <SectionSub>First time? Follow the steps. Nothing assumed.</SectionSub>
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Reveal>
          <div className={card}>
            <h3 className="display text-xl font-semibold">Paste the steps</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed text-muted">
              <li>Every box starts blank — answer only what you need, skip the rest.</li>
              <li>
                Hover any step and hit Copy — the whole block copies at once. Paste
                into your terminal, press Enter.
              </li>
              <li>
                Once you enter <code className="font-mono text-sm text-ink">{dir}</code>,
                stay there.
              </li>
              <li>
                The last step starts your app — leave that window open.{" "}
                <code className="font-mono text-sm text-ink">Ctrl+C</code> stops it.
              </li>
            </ol>
            <Code lines={[`cd ${dir}`, "npm run dev"]} label="run commands" />
          </div>
        </Reveal>
        <Reveal delay={90}>
          <div className={card}>
            <h3 className="display text-xl font-semibold">Or run it all at once</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed text-muted">
              <li>
                Press <strong className="text-ink">Download .sh</strong>, then run this.
                It answers every question itself.
              </li>
              <li>Start your app yourself after it finishes.</li>
              <li>Separate backend? It gets its own window.</li>
              <li>
                Failed?{" "}
                <code className="font-mono text-sm text-ink">rm -rf {dir}</code>, run
                again.
              </li>
            </ol>
            <Code lines={["chmod +x setup.sh", "./setup.sh"]} label="script commands" />
          </div>
        </Reveal>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal>
          <div className={card}>
            <h3 className="display text-xl font-semibold">Phones?</h3>
            <p className="mt-2 leading-relaxed text-muted">
              Building for mobile? Pick Android or iPhone first — the run commands
              follow your phone.
            </p>
          </div>
        </Reveal>
        <Reveal delay={60}>
          <div className={card}>
            <h3 className="display text-xl font-semibold">Keys</h3>
            <p className="mt-2 leading-relaxed text-muted">
              Keys go in one file. Copy them from each service&rsquo;s site. The steps
              add the file to .gitignore, so it never gets committed.
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className={card}>
            <h3 className="display text-xl font-semibold">Share</h3>
            <p className="mt-2 leading-relaxed text-muted">
              The page address matches your answers. Send it to a friend — they get your
              exact steps.
            </p>
          </div>
        </Reveal>
        <Reveal delay={180}>
          <div className={card}>
            <h3 className="display text-xl font-semibold">Stuck?</h3>
            <p className="mt-2 leading-relaxed text-muted">
              Wrong folder?{" "}
              <code className="font-mono text-sm text-ink">cd {dir}</code> and repeat
              the step. Else delete {dir} and start over.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
