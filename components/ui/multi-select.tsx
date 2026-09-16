"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MultiOption = { id: string; label: string; hint?: string };

/**
 * Where an arrow key moves focus inside the open panel. `current` is -1 when
 * focus is not on a checkbox yet (trigger, or the Clear all button).
 * Exported so the keyboard contract is unit-testable without a DOM.
 */
export function nextRovingIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : (current + 1) % count;
    case "ArrowUp":
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

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

/**
 * Multi-choice picker with the same look as FieldSelect: a disclosure button
 * revealing a group of native checkboxes. Not a listbox — a listbox may not
 * contain checkboxes, and screen readers announced the old markup as an empty
 * list. Keyboard contract: Arrow keys roam the boxes, Home/End jump, Space
 * toggles (native), Escape and Tab close and return focus to the trigger.
 *
 * `value` is the list of selected option ids (empty = nothing picked).
 */
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
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const boxesRef = useRef<(HTMLInputElement | null)[]>([]);
  const panelId = `${id}-options`;

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setFocusIndex(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Click outside closes. Focus stays where the user put it.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusIndex(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Opening moves focus into the group so the arrow keys have somewhere to
  // land. Driven by state (not by `open`) so toggling a box never steals it.
  useEffect(() => {
    if (focusIndex === null) return;
    boxesRef.current[focusIndex]?.focus();
  }, [focusIndex]);

  const openPanel = (index: number) => {
    setOpen(true);
    setFocusIndex(Math.min(Math.max(index, 0), Math.max(options.length - 1, 0)));
  };

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openPanel(e.key === "ArrowDown" ? 0 : options.length - 1);
      }
      return;
    }
    // Escape used to leave focus on nothing — the page body. Hand it back.
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      close(true);
      return;
    }
    const current = boxesRef.current.findIndex((el) => el && el === document.activeElement);
    const next = nextRovingIndex(e.key, current, options.length);
    if (next === null) return;
    e.preventDefault();
    setFocusIndex(next);
    boxesRef.current[next]?.focus();
  }

  const toggle = (oid: string) =>
    onChange(value.includes(oid) ? value.filter((v) => v !== oid) : [...value, oid]);

  const summary =
    value.length === 0
      ? null
      : value.length === 1
        ? (options.find((o) => o.id === value[0])?.label ?? value[0])
        : `${value.length} skills selected`;

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close(false) : openPanel(0))}
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
          id={panelId}
          role="group"
          aria-label={label}
          className="select-content absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-[0_16px_40px_-16px_rgba(27,20,13,0.35)]"
        >
          {options.map((o, i) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium select-none hover:bg-parchment"
            >
              <input
                type="checkbox"
                checked={value.includes(o.id)}
                onChange={() => toggle(o.id)}
                ref={(el) => {
                  boxesRef.current[i] = el;
                }}
                className="field-check !mt-0"
              />
              <span>
                {o.label}
                {o.hint ? <span className="font-normal text-muted"> — {o.hint}</span> : null}
              </span>
            </label>
          ))}
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
