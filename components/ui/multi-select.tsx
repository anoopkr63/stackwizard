"use client";

import { useEffect, useRef, useState } from "react";

export type MultiOption = { id: string; label: string; hint?: string };

function ChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Multi-choice dropdown with the same look as FieldSelect.
 *  `value` is the list of selected option ids (empty = nothing picked). */
export default function FieldMultiSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: MultiOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const toggle = (oid: string) =>
    onChange(value.includes(oid) ? value.filter((v) => v !== oid) : [...value, oid]);

  const summary =
    value.length === 0
      ? null
      : value.length === 1
        ? (options.find((o) => o.id === value[0])?.label ?? value[0])
        : `${value.length} skills selected`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="select-trigger flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-ink/15 bg-white px-3.5 py-2 text-left text-[15px] font-medium text-ink transition-colors hover:border-ink/35"
      >
        <span className="min-w-0 flex-1">
          {summary ?? <span className="font-normal text-muted">{placeholder ?? "Select…"}</span>}
          {value.length === 1 && options.find((o) => o.id === value[0])?.hint ? (
            <span className="font-normal text-muted">
              {" "}
              — {options.find((o) => o.id === value[0])?.hint}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="select-content absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-[0_16px_40px_-16px_rgba(27,20,13,0.35)]"
        >
          {options.map((o) => {
            const checked = value.includes(o.id);
            return (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium select-none hover:bg-parchment"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(o.id)}
                  className="field-check !mt-0"
                  aria-label={o.label}
                />
                <span>
                  {o.label}
                  {o.hint ? <span className="font-normal text-muted"> — {o.hint}</span> : null}
                </span>
              </label>
            );
          })}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-muted hover:bg-parchment hover:text-ink"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
