export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted">
      {children}
    </p>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="display mt-4 text-3xl font-semibold leading-tight sm:text-4xl lg:text-[44px]">
      {children}
    </h2>
  );
}

export function SectionSub({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{children}</p>;
}

/** Hand-drawn ellipse highlight that draws itself when its Reveal fires. */
export function Ellipse({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block px-2">
      <svg
        aria-hidden="true"
        viewBox="0 0 300 110"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <ellipse
          cx="150"
          cy="55"
          rx="142"
          ry="47"
          fill="none"
          stroke="var(--color-ember)"
          strokeWidth="5"
          strokeLinecap="round"
          className="ellipse-path"
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}
