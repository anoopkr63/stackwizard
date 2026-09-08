"use client";

import { useEffect, useMemo, useState } from "react";
import web from "@/data/web.json";
import addons from "@/data/addons.json";
import { assemble, buildScript, defaultSelections, PRESETS } from "@/lib/assemble";
import { decodeSelections, encodeSelections } from "@/lib/share";
import type { WizardSelections } from "@/lib/types";
import { SectionEyebrow, SectionSub, SectionTitle } from "./Section";
import Reveal from "./Reveal";
import FieldSelect from "./ui/select";

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(27,20,13,0.06)]">
      <label htmlFor={id} className="display block text-[15px] font-semibold">
        {label}
      </label>
      {help && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{help}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function Wizard() {
  const [sel, setSel] = useState<WizardSelections>(() => defaultSelections());
  const [copied, setCopied] = useState<"commands" | "link" | null>(null);
  const [loadedFromLink, setLoadedFromLink] = useState(false);

  // Load shared selections once from ?s=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const decoded = decodeSelections(params.get("s"));
    if (decoded) {
      setSel({ ...defaultSelections(), ...decoded });
      setLoadedFromLink(true);
    }
  }, []);

  const steps = useMemo(() => assemble(sel), [sel]);
  const commandText = useMemo(() => steps.map((s) => s.command).join("\n"), [steps]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?s=${encodeSelections(sel)}`;
  }, [sel]);

  // Keep the address bar in sync so the link is always shareable
  useEffect(() => {
    const url = `${window.location.pathname}?s=${encodeSelections(sel)}`;
    window.history.replaceState(null, "", url);
  }, [sel]);

  const set = <K extends keyof WizardSelections>(key: K, value: WizardSelections[K]) => {
    setSel((prev) => ({ ...prev, [key]: value }));
    setCopied(null);
  };

  const ormHidden = ["none", "supabase", "firebase"].includes(sel.addons.database);

  // Commands scaffold; they don't write app code. Name exactly what's left
  // so the user isn't surprised after the last command runs.
  const codeGaps = useMemo(() => {
    const gaps: string[] = [];
    if ((sel.addons.backend ?? "none") !== "none") {
      gaps.push(
        "API: add GET /health + login checks."
      );
    }
    if ((sel.addons.auth ?? "none") !== "none") {
      gaps.push(
        "Login: add callback route + session check."
      );
    }
    const pay = sel.addons.payments ?? "none";
    if (pay !== "none" && pay !== "lemonsqueezy") {
      gaps.push(
        "Payments: add a webhook route."
      );
    }
    return gaps;
  }, [sel]);

  async function copyText(text: string, which: "commands" | "link") {
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
    setCopied(which);
    window.setTimeout(() => setCopied(null), 2000);
  }

  function downloadScript() {
    const blob = new Blob([buildScript(steps)], { type: "text/x-sh" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "setup.sh";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const cat = (id: string) => web.categories.find((c) => c.id === id);

  return (
    <section id="build" className="scroll-mt-20 border-y border-line bg-parchment">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <Reveal>
          <SectionEyebrow>Build my stack · Web</SectionEyebrow>
          <SectionTitle>Answer the questions. Watch the commands appear.</SectionTitle>
          <SectionSub>
            Updates live as you pick.
          </SectionSub>
        </Reveal>
        {loadedFromLink && (
          <p role="status" className="mt-4 inline-block rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream">
            Opened from a shared link.
          </p>
        )}

        <div id="examples" className="mt-6 flex scroll-mt-24 flex-wrap gap-2">
          <span className="w-full text-sm font-semibold uppercase tracking-widest text-muted">
            Presets:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSel(p.selections)}
              className="rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-semibold hover:border-ink hover:bg-ink hover:text-cream"
              title={p.detail}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSel(defaultSelections())}
            className="rounded-full border border-dashed border-ink/30 px-4 py-2 text-sm font-semibold text-muted hover:border-ink hover:text-ink"
          >
            Reset all
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* ---- Form ---- */}
          <div className="space-y-6">
            <fieldset>
              <legend className="display mb-3 text-lg font-semibold">
                Platform <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-xs text-cream">Web · live</span>
              </legend>
              <div className="grid grid-cols-3 gap-2" role="note" aria-label="Platforms">
                {["Web", "Mobile", "Desktop"].map((p) => (
                  <div
                    key={p}
                    className={`rounded-xl border p-3 text-center text-sm font-semibold ${
                      p === "Web" ? "border-ink bg-white ring-1 ring-ink" : "border-line bg-white/60 text-muted"
                    }`}
                  >
                    {p}
                    {p !== "Web" && <span className="block text-xs font-normal">coming soon</span>}
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="display mb-3 text-lg font-semibold">Core — what the site is made of</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {["language", "framework", "styling", "packageManager"].map((id) => {
                  const c = cat(id);
                  if (!c) return null;
                  const value = sel[id as "language" | "framework" | "styling" | "packageManager"];
                  return (
                    <Field key={id} id={`f-${id}`} label={c.label} help={c.help}>
                      <FieldSelect
                        id={`f-${id}`}
                        label={c.label}
                        value={value}
                        onChange={(v) => set(id as "language", v as never)}
                        options={c.options}
                      />
                    </Field>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="display mb-3 text-lg font-semibold">Code health — optional, recommended</legend>
              <div className="grid gap-3">
                {addons.groups
                  .filter((g) => g.toggles)
                  .flatMap((g) => g.toggles!)
                  .map((t) => (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(27,20,13,0.06)] hover:border-ink"
                    >
                      <input
                        type="checkbox"
                        checked={!!sel.toggles[t.id]}
                        onChange={(e) => setSel((p) => ({ ...p, toggles: { ...p.toggles, [t.id]: e.target.checked } }))}
                        className="field-check"
                      />
                      <span>
                        <span className="display block font-semibold">{t.label}</span>
                        <span className="text-sm text-muted">{t.help}</span>
                      </span>
                    </label>
                  ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="display mb-3 text-lg font-semibold">Extras — only pick what you need</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {addons.groups
                  .filter((g) => g.options)
                  .map((g) => {
                    if (g.id === "orm" && ormHidden) return null;
                    return (
                      <Field key={g.id} id={`a-${g.id}`} label={g.label} help={g.help}>
                        <FieldSelect
                          id={`a-${g.id}`}
                          label={g.label}
                          value={sel.addons[g.id] ?? "none"}
                          onChange={(v) =>
                            setSel((p) => ({ ...p, addons: { ...p.addons, [g.id]: v } }))
                          }
                          options={g.options!}
                        />
                      </Field>
                    );
                  })}
              </div>
              {ormHidden && (
                <p className="mt-2 text-sm text-muted">
                  Not needed for this database.
                </p>
              )}
            </fieldset>
          </div>

          {/* ---- Output ---- */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-xl bg-night text-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="font-mono text-xs uppercase tracking-widest text-white/60">
                  Your commands · {steps.length} lines
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={downloadScript}
                    className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                  >
                    Download .sh
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(shareUrl, "link")}
                    className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                  >
                    {copied === "link" ? "Link copied ✓" : "Copy share link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(commandText, "commands")}
                    className="rounded-full bg-ember px-3 py-1.5 text-xs font-semibold text-white hover:bg-ember-deep"
                  >
                    {copied === "commands" ? "Copied ✓" : "Copy all"}
                  </button>
                </div>
              </div>
              <div
                className="max-h-[380px] overflow-y-auto bg-night-soft p-4 font-mono text-[13px] leading-7 sm:text-sm"
                aria-live="polite"
                aria-label="Generated terminal commands"
              >
                {steps.map((s, i) => (
                  <p key={`${s.command}-${i}`} className={s.command.startsWith("#") ? "text-white/50" : "whitespace-pre-wrap"}>
                    {!s.command.startsWith("#") && !s.command.includes("\n") && (
                      <span aria-hidden="true" className="mr-2 select-none text-ember">
                        $
                      </span>
                    )}
                    {s.command}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(27,20,13,0.06)]">
              <h3 className="display text-lg font-semibold">What each line does</h3>
              <ol className="mt-3 space-y-3">
                {steps.map((s, i) => (
                  <li key={`n-${i}`} className="flex gap-3 text-sm leading-relaxed">
                    <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-parchment text-xs font-bold">
                      {i + 1}
                    </span>
                    <span>
                      <code className="break-all font-mono text-[13px] font-medium">{s.command}</code>
                      <span className="block text-muted">{s.note}</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted/80">{s.section}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-xl bg-parchment p-3 text-sm text-muted">
                Run it all at once with Download .sh — or paste one block at a time.
              </div>
              {codeGaps.length > 0 && (
                <div className="mt-3 rounded-xl border border-dashed border-ink/30 p-3 text-sm">
                  <p className="font-semibold">Still needs code</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                    {codeGaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
