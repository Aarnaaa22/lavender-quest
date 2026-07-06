import { useMemo } from "react";

type Props = {
  /** Number of drifting sparkles. */
  count?: number;
  /** Optional custom className applied to the wrapper. */
  className?: string;
  /** Show larger glowing lavender orbs behind the sparkles. */
  orbs?: boolean;
};

/**
 * SparkleField — a reusable, fixed-position particle background with
 * lavender gradients, drifting motion, and gentle glow pulsing.
 *
 * Purely presentational and pointer-events-none, so it can sit under
 * any page content without interfering with input.
 */
export function SparkleField({ count = 60, className = "", orbs = true }: Props) {
  const sparkles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 5,
        driftX: (Math.random() - 0.5) * 60,
        driftY: -20 - Math.random() * 80,
        duration: 8 + Math.random() * 10,
        delay: Math.random() * 8,
        pulseDuration: 2.4 + Math.random() * 2.6,
        hue: ["#f5d0fe", "#e9d5ff", "#ddd6fe", "#fbcfe8", "#ffffff"][i % 5],
      })),
    [count],
  );

  const glowOrbs = useMemo(
    () =>
      orbs
        ? Array.from({ length: 5 }, (_, i) => ({
            id: i,
            left: 10 + Math.random() * 80,
            top: 10 + Math.random() * 80,
            size: 240 + Math.random() * 220,
            delay: Math.random() * 5,
            duration: 10 + Math.random() * 8,
            hue:
              i % 2 === 0
                ? "radial-gradient(circle, rgba(216,180,254,0.35), transparent 70%)"
                : "radial-gradient(circle, rgba(251,207,232,0.28), transparent 70%)",
          }))
        : [],
    [orbs],
  );

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      {/* Layered lavender gradient wash */}
      <div className="absolute inset-0 sparkle-field-bg" />

      {/* Soft drifting glow orbs */}
      {glowOrbs.map((o) => (
        <span
          key={`orb-${o.id}`}
          className="absolute rounded-full sparkle-orb"
          style={{
            left: `${o.left}%`,
            top: `${o.top}%`,
            width: o.size,
            height: o.size,
            background: o.hue,
            animationDelay: `${o.delay}s`,
            animationDuration: `${o.duration}s`,
          }}
        />
      ))}

      {/* Drifting, pulsing sparkles */}
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full sparkle-dot"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: s.hue,
            boxShadow: `0 0 ${s.size * 2}px ${s.hue}, 0 0 ${s.size * 4}px ${s.hue}`,
            animationDuration: `${s.duration}s, ${s.pulseDuration}s`,
            animationDelay: `${s.delay}s, ${s.delay * 0.4}s`,
            ["--sx" as string]: `${s.driftX}px`,
            ["--sy" as string]: `${s.driftY}px`,
          }}
        />
      ))}
    </div>
  );
}

export default SparkleField;
