"use client";

/* Scattered twinkling stars — exact swp-twinkle reference timing.
   Deterministic positions so server + client render match. */
const STARS: {
  left: string;
  top: string;
  size: number;
  duration: string;
  delay: string;
}[] = [
  { left: "6%", top: "18%", size: 5, duration: "4.2s", delay: "0s" },
  { left: "12%", top: "66%", size: 4, duration: "5s", delay: "0.6s" },
  { left: "21%", top: "30%", size: 6, duration: "4.6s", delay: "1.2s" },
  { left: "79%", top: "22%", size: 5, duration: "3.8s", delay: "0.4s" },
  { left: "88%", top: "58%", size: 4, duration: "4.8s", delay: "1.8s" },
  { left: "93%", top: "34%", size: 6, duration: "5.4s", delay: "0.9s" },
  { left: "84%", top: "76%", size: 5, duration: "4.2s", delay: "1.4s" },
  { left: "15%", top: "82%", size: 4, duration: "5s", delay: "0.2s" },
];

export default function TwinkleField({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      {STARS.map((s, i) => (
        <span
          key={i}
          className="anim-twinkle-exact absolute rounded-full bg-ember"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDuration: s.duration,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}
