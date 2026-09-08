"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/* Original stack-flavored chips scattered around the hero like confetti */
const CHIPS: { text: string; color: string; rot: string; x: string; y: string; delay: string }[] = [
  { text: "TypeScript", color: "bg-ember text-white", rot: "-8deg", x: "4%", y: "22%", delay: "0ms" },
  { text: "PostgreSQL", color: "bg-ink text-cream", rot: "6deg", x: "10%", y: "58%", delay: "600ms" },
  { text: "Tailwind", color: "bg-leaf text-white", rot: "-5deg", x: "18%", y: "36%", delay: "1200ms" },
  { text: "npm install", color: "bg-white text-ink border border-line", rot: "7deg", x: "6%", y: "74%", delay: "300ms" },
  { text: "Stripe", color: "bg-ink text-cream", rot: "-6deg", x: "82%", y: "30%", delay: "900ms" },
  { text: "Prisma", color: "bg-ember text-white", rot: "8deg", x: "90%", y: "60%", delay: "1500ms" },
  { text: "Auth", color: "bg-white text-ink border border-line", rot: "-7deg", x: "76%", y: "72%", delay: "450ms" },
  { text: "Docker", color: "bg-leaf text-white", rot: "5deg", x: "88%", y: "20%", delay: "1100ms" },
];

const STORAGE_KEY = "stackwizard-chips";

type XY = { x: number; y: number };

export default function ChipScatter() {
  const [offsets, setOffsets] = useState<Record<string, XY>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offsetsRef = useRef<Record<string, XY>>({});
  const dragRef = useRef({ id: "", startX: 0, startY: 0, origX: 0, origY: 0 });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        offsetsRef.current = JSON.parse(saved);
        setOffsets(offsetsRef.current);
      }
    } catch {
      /* fresh layout */
    }
  }, []);

  function clamp(id: string, x: number, y: number, el: HTMLElement): XY {
    const container = containerRef.current;
    if (!container) return { x, y };
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const off = offsetsRef.current[id] ?? { x: 0, y: 0 };
    const baseLeft = r.left - off.x;
    const baseTop = r.top - off.y;
    return {
      x: Math.min(Math.max(x, c.left + 8 - baseLeft), c.right - 8 - baseLeft - r.width),
      y: Math.min(Math.max(y, c.top + 8 - baseTop), c.bottom - 8 - baseTop - r.height),
    };
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const d = dragRef.current;
    const off = offsetsRef.current[id] ?? { x: 0, y: 0 };
    d.id = id;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.origX = off.x;
    d.origY = off.y;
    setDraggingId(id);
    setOffsets({ ...offsetsRef.current });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent, id: string, el: HTMLElement) {
    const d = dragRef.current;
    if (d.id !== id) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const next = clamp(id, d.origX + dx, d.origY + dy, el);
    offsetsRef.current = { ...offsetsRef.current, [id]: next };
    // Write straight to the DOM — no React re-render per pixel, so it tracks 1:1.
    el.style.transform = `translate(${next.x}px, ${next.y}px)`;
  }

  function endDrag(e: React.PointerEvent, id: string) {
    const d = dragRef.current;
    if (d.id !== id) return;
    d.id = "";
    setDraggingId(null);
    // Single commit on release: sync state + persist.
    setOffsets({ ...offsetsRef.current });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(offsetsRef.current));
    } catch {
      /* persistence is best-effort */
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  function resetAll() {
    offsetsRef.current = {};
    setOffsets({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      onDoubleClick={resetAll}
      title="Drag the chips · double-click to reset"
      className="pointer-events-none absolute inset-0 z-10 hidden lg:block"
    >
      {CHIPS.map((c) => {
        const off = offsets[c.text] ?? { x: 0, y: 0 };
        const dragging = draggingId === c.text;
        return (
          <span
            key={c.text}
            onPointerDown={(e) => onPointerDown(e, c.text)}
            onPointerMove={(e) => onPointerMove(e, c.text, e.currentTarget)}
            onPointerUp={(e) => endDrag(e, c.text)}
            onPointerCancel={(e) => endDrag(e, c.text)}
            style={{ left: c.x, top: c.y, transform: `translate(${off.x}px, ${off.y}px)` }}
            className={`pointer-events-auto absolute touch-pan-y select-none ${
              dragging ? "z-10 cursor-grabbing" : "cursor-grab"
            }`}
          >
            <span
              className={`anim-chip block rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg ${c.color} ${
                dragging ? "[animation-play-state:paused]" : ""
              }`}
              style={{ "--chip-rot": c.rot, "--chip-delay": c.delay } as CSSProperties}
            >
              {c.text}
            </span>
          </span>
        );
      })}
    </div>
  );
}
