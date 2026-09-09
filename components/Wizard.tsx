"use client";

import { useEffect, useMemo, useState } from "react";
import addons from "@/data/addons.json";
import { assemble, buildScript, catalogFor, defaultSelections, isOptionVisible, PRESETS, sanitizeAppName } from "@/lib/assemble";
import { decodeRoute, decodeSelections, encodeRoute } from "@/lib/share";
import type { PlatformId, WizardSelections } from "@/lib/types";
import { SectionEyebrow, SectionSub, SectionTitle } from "./Section";
import Reveal from "./Reveal";
import FieldSelect from "./ui/select";
import FieldMultiSelect from "./ui/multi-select";
import { useSelection } from "./SelectionProvider";

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
  // Selections live in the page-level provider so Hero/Guide/FAQ see the
  // same live values (e.g. the app folder name). All update logic below is
  // unchanged — only the state owner moved.
  const { sel, setSel } = useSelection();
  const [copied, setCopied] = useState<"commands" | "link" | null>(null);
  const [copiedGroup, setCopiedGroup] = useState<number | null>(null);

  // Load shared selections once — short route /s/<combo> first, legacy ?s=
  // fallback. Mount-only client init (window doesn't exist during SSR, so this
  // can't move into a state initializer without a hydration mismatch).
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const m = window.location.pathname.match(/^\/s\/([^/]+)\/?$/);
    const decoded = m
      ? decodeRoute(m[1])
      : decodeSelections(new URLSearchParams(window.location.search).get("s"));
    if (decoded) {
      setSel({ ...defaultSelections(), ...decoded });
    }
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const steps = useMemo(() => assemble(sel), [sel]);
  const commandText = useMemo(() => steps.map((s) => s.command).join("\n"), [steps]);
  // One copy unit per numbered block: consecutive lines under the same
  // section paste as a group (scaffold + cd, installs, heredoc).
  const groups = useMemo(() => {
    const out: { section: string; steps: typeof steps }[] = [];
    for (const s of steps) {
      const last = out[out.length - 1];
      if (last && last.section === s.section) last.steps.push(s);
      else out.push({ section: s.section, steps: [s] });
    }
    return out;
  }, [steps]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const r = encodeRoute(sel);
    const path = r ? `/s/${r}` : "/";
    return `${window.location.origin}${path}`;
  }, [sel]);

  // Share links are built on demand (copy-link button) — picking answers
  // keeps the address bar clean. If the page was opened on a shared link,
  // the first change drops it back to "/" so the URL never lies.
  function touch() {
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
    }
  }

  const set = <K extends keyof WizardSelections>(key: K, value: WizardSelections[K]) => {
    setSel((prev) => ({ ...prev, [key]: value }));
    setCopied(null);
    setCopiedGroup(null);
    touch();
  };

  function resetAll() {
    setSel(defaultSelections());
    setCopied(null);
    setCopiedGroup(null);
    touch();
  }

  function applyPreset(selections: WizardSelections) {
    setSel(selections);
    setCopied(null);
    setCopiedGroup(null);
    touch();
  }

  const ormHidden = ["", "none", "supabase", "firebase"].includes(sel.addons.database || "none");

  const platform: PlatformId = sel.platform ?? "web";
  const platformLabel = platform === "mobile" ? "Mobile" : platform === "desktop" ? "Desktop" : "Web";
  const appDir = sanitizeAppName(sel.appName, sel);
  const appRaw = (sel.appName ?? "").trim();

  function switchPlatform(p: PlatformId) {
    touch();
    setSel((prev) => {
      const next: WizardSelections = {
        ...prev,
        platform: p,
        language: "",
        framework: "",
        styling: "",
        addons: { ...prev.addons },
      };
      // Fresh platform, fresh rules — drop picks the new platform doesn't offer
      // (e.g. NextAuth on mobile) instead of leaving a dropdown blank.
      for (const g of addons.groups) {
        if (!g.options) continue;
        const cur = next.addons[g.id] || "none";
        const opt = g.options.find((o) => o.id === cur);
        if (cur !== "none" && (!opt || !isOptionVisible(opt, next))) {
          next.addons[g.id] = "";
        }
      }
      return next;
    });
    setCopied(null);
    setCopiedGroup(null);
  }

  // Commands scaffold; they don't write app code. Name exactly what's left
  // so the user isn't surprised after the last command runs.
  const codeGaps = useMemo(() => {
    const gaps: string[] = [];
    if ((sel.addons.backend || "none") !== "none") {
      gaps.push(
        "API: add GET /health + login checks."
      );
    }
    if ((sel.addons.auth || "none") !== "none") {
      gaps.push(
        platform === "mobile"
          ? "Login: wire the provider SDK into your navigation."
          : platform === "desktop"
            ? "Login: wire the provider SDK into your app window."
            : "Login: add callback route + session check."
      );
    }
    const pay = sel.addons.payments || "none";
    if (pay !== "none" && pay !== "lemonsqueezy") {
      gaps.push(
        pay === "revenuecat"
          ? "Payments: connect App Store / Play in the RevenueCat dashboard."
          : platform === "desktop"
            ? "Payments: verify on your server — desktop apps can't hold secret keys."
            : "Payments: add a webhook route."
      );
    }
    return gaps;
  }, [sel, platform]);

  async function writeClipboard(text: string) {
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
  }

  async function copyText(text: string, which: "commands" | "link") {
    await writeClipboard(text);
    setCopiedGroup(null);
    setCopied(which);
    window.setTimeout(() => setCopied(null), 2000);
  }

  async function copyGroup(text: string, gi: number) {
    await writeClipboard(text);
    setCopied(null);
    setCopiedGroup(gi);
    window.setTimeout(() => setCopiedGroup(null), 2000);
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

  const cat = (id: string) => catalogFor(platform).categories.find((c) => c.id === id);

  return (
    <section id="build" className="scroll-mt-20 border-y border-line bg-parchment">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <Reveal>
          <SectionEyebrow>Build my stack · {platformLabel}</SectionEyebrow>
          <SectionTitle>Answer the questions. Watch the commands appear.</SectionTitle>
          <SectionSub>
            Updates as you pick.
          </SectionSub>
        </Reveal>
        <div id="examples" className="mt-6 flex scroll-mt-24 flex-wrap gap-2">
          <span className="w-full text-sm font-semibold uppercase tracking-widest text-muted">
            Presets:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.selections)}
              className="rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-semibold hover:border-ink hover:bg-ink hover:text-cream"
              title={p.detail}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => resetAll()}
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
                Platform
              </legend>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Platforms">
                {(["web", "mobile", "desktop"] as PlatformId[]).map((p) => {
                  const active = platform === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => switchPlatform(p)}
                      aria-pressed={active}
                      className={`rounded-xl border p-3 text-center text-sm font-semibold transition-colors ${
                        active
                          ? "border-ink bg-white ring-1 ring-ink"
                          : "border-line bg-white/60 text-muted hover:border-ink/40 hover:text-ink"
                      }`}
                    >
                      {p === "web" ? "Web" : p === "mobile" ? "Mobile" : "Desktop"}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Field
              id="f-appname"
              label="App name"
              help="Folder your project is created in. Lowercase letters, numbers, dashes."
            >
              <input
                id="f-appname"
                type="text"
                value={sel.appName}
                onChange={(e) => set("appName", e.target.value)}
                placeholder="my-app"
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none"
              />
              {appRaw && appRaw !== appDir && (
                <p className="mt-1.5 text-[13px] text-muted">
                  Folder: <code className="font-mono text-ink">{appDir}</code>
                  {platform === "mobile" && sel.framework === "react-native"
                    ? " — native code needs one word, no dashes."
                    : " — cleaned up to a safe folder name."}
                </p>
              )}
            </Field>

            {platform === "mobile" && (
              <fieldset>
                <legend className="display mb-3 text-lg font-semibold">
                  Target — pick your phone{" "}
                  <span className="ml-1 rounded-full bg-ember px-2.5 py-0.5 align-middle text-xs font-bold uppercase tracking-wider text-white">
                    Required
                  </span>
                </legend>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Target phone">
                  {(
                    [
                      { id: "android", label: "Android", sub: "most users" },
                      { id: "ios", label: "iPhone", sub: "needs a Mac" },
                    ] as const
                  ).map((o) => {
                    const active = (sel.target ?? "android") === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => set("target", o.id)}
                        aria-pressed={active}
                        className={`rounded-xl border p-3 text-center text-sm font-semibold transition-colors ${
                          active
                            ? "border-ink bg-white ring-1 ring-ink"
                            : "border-line bg-white/60 text-muted hover:border-ink/40 hover:text-ink"
                        }`}
                      >
                        {o.label}
                        <span className="block text-xs font-normal">{o.sub}</span>
                      </button>
                    );
                })}
              </div>
            </fieldset>
            )}

            <fieldset>
              <legend className="display mb-3 text-lg font-semibold">
                {platform === "web" ? "Core — what the site is made of" : "Core — what the app is made of"}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {["language", "framework", "styling", "packageManager"].map((id) => {
                  const c = cat(id);
                  if (!c) return null;
                  const value = sel[id as "language" | "framework" | "styling" | "packageManager"];
                  return (
                    <Field key={id} id={`f-${id}`} label={c.label}>
                      <FieldSelect
                        id={`f-${id}`}
                        label={c.label}
                        value={value}
                        onChange={(v) => set(id as "language", v as never)}
                        options={c.options}
                        placeholder={c.help}
                      />
                    </Field>
                  );
                })}
              </div>
            </fieldset>

            {addons.groups
              .filter((g) => g.toggles)
              .map((g) => (
                <fieldset key={g.id}>
                  <legend className="display mb-3 text-lg font-semibold">
                    {g.id === "code-health" ? "Code health — optional, recommended" : g.label}
                  </legend>
                  <div className="grid gap-3">
                    {g.toggles!
                      .filter(
                        (t) =>
                          (!t.platforms || t.platforms.includes(platform)) &&
                          (!t.frameworks || t.frameworks.includes(sel.framework))
                      )
                      .map((t) => (
                      <label
                      key={t.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(27,20,13,0.06)] hover:border-ink"
                    >
                      <input
                        type="checkbox"
                        checked={!!sel.toggles[t.id]}
                        onChange={(e) => { touch(); setSel((p) => ({ ...p, toggles: { ...p.toggles, [t.id]: e.target.checked } })); }}
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
              ))}

            <fieldset>
              <legend className="display mb-3 text-lg font-semibold">Extras — only pick what you need</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {addons.groups
                  .filter((g) => g.options)
                  .map((g) => {
                    if (g.id === "orm" && ormHidden) return null;
                    // AI skills is the one multi-choice dropdown — same place,
                    // same look, checkboxes inside. Stored as comma-separated
                    // ids so share links keep working as plain strings.
                    if (g.id === "skills") {
                      const raw = sel.addons[g.id] || "none";
                      const picked = raw === "none" ? [] : raw.split(",").filter(Boolean);
                      return (
                        <Field key={g.id} id={`a-${g.id}`} label={g.label}>
                          <FieldMultiSelect
                            id={`a-${g.id}`}
                            label={g.label}
                            value={picked}
                            onChange={(ids) => {
                              touch();
                              setSel((p) => ({
                                ...p,
                                addons: {
                                  ...p.addons,
                                  [g.id]: ids.length ? ids.join(",") : "",
                                },
                              }));
                            }}
                            options={g
                              .options!.filter(
                                (o) => o.id !== "none" && isOptionVisible(o, sel)
                              )
                              .map((o) => ({ id: o.id, label: o.label, hint: o.hint }))}
                            placeholder={g.help}
                          />
                        </Field>
                      );
                    }
                    return (
                      <Field key={g.id} id={`a-${g.id}`} label={g.label}>
                        <FieldSelect
                          id={`a-${g.id}`}
                          label={g.label}
                          value={sel.addons[g.id] || ""}
                          onChange={(v) => {
                            touch();
                            setSel((p) => {
                              const next: WizardSelections = {
                                ...p,
                                addons: { ...p.addons, [g.id]: v },
                              };
                              // A changed pick can orphan others (e.g. DB away
                              // from MongoDB with Mongoose set) — blank picks
                              // that are no longer visible instead of leaving
                              // a stale value behind.
                              for (const gg of addons.groups) {
                                if (!gg.options) continue;
                                if (gg.id === "skills") continue; // multi-value, validated per-id below
                                if (
                                  gg.id === "orm" &&
                                  ["", "none", "supabase", "firebase"].includes(
                                    next.addons.database || "none"
                                  )
                                ) {
                                  next.addons.orm = "";
                                  continue;
                                }
                                const cur = next.addons[gg.id] || "none";
                                const opt = gg.options.find((o) => o.id === cur);
                                if (cur !== "none" && (!opt || !isOptionVisible(opt, next))) {
                                  next.addons[gg.id] = "";
                                }
                              }
                              return next;
                            });
                          }}
                          options={g.options!.filter((o) => isOptionVisible(o, sel))}
                          placeholder={g.help}
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
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
                <p className="font-mono text-xs uppercase tracking-widest text-white/60">
                  Your commands · {groups.length} steps
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadScript}
                    className="whitespace-nowrap rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                  >
                    Download .sh
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(shareUrl, "link")}
                    className="whitespace-nowrap rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                  >
                    {copied === "link" ? "Link copied ✓" : "Copy share link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(commandText, "commands")}
                    className="whitespace-nowrap rounded-full bg-ember px-3 py-1.5 text-xs font-semibold text-white hover:bg-ember-deep"
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
                {groups.map((g, gi) => (
                  <div key={g.section} className="group mb-3 last:mb-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="font-sans text-[11px] font-bold uppercase tracking-widest text-white/40">
                        {g.section}
                      </p>
                      {!g.steps.every((s) => s.command.startsWith("#")) && (
                      <button
                        type="button"
                        onClick={() => copyGroup(g.steps.map((s) => s.command).join("\n"), gi)}
                        aria-label={`Copy ${g.section}`}
                        title="Copy this step"
                        className="shrink-0 rounded-md px-1.5 py-0.5 font-sans text-[11px] font-semibold text-white/40 opacity-0 transition-opacity hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        {copiedGroup === gi ? "Copied" : "Copy"}
                      </button>
                      )}
                    </div>
                    {g.steps.map((s, i) => {
                      const extra = s.command.includes("\n") ? s.command.split("\n").length - 1 : 0;
                      return (
                        <p key={`${s.command}-${i}`} className={s.command.startsWith("#") ? "text-white/50" : "whitespace-pre-wrap"}>
                          {!s.command.startsWith("#") && !extra && (
                            <span aria-hidden="true" className="mr-2 select-none text-ember">
                              $
                            </span>
                          )}
                          {extra ? s.command.split("\n")[0] : s.command}
                          {extra > 0 && (
                            <span className="block text-xs text-white/40">
                              … {extra} more lines — pastes as one block
                            </span>
                          )}
                        </p>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(27,20,13,0.06)]">
              <h3 className="display text-lg font-semibold">What each step does</h3>
              <div className="mt-3 space-y-4">
                {groups.map((g) => (
                  <div key={`n-${g.section}`}>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted">
                      {g.section}
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {g.steps.map((s, i) => (
                        <li key={`n-${i}`} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                          <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ember" />
                          <span>{s.note || s.command.split("\n")[0]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-parchment p-3 text-sm text-muted">
                Run it all at once with Download .sh — or hover any step to copy it.
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
