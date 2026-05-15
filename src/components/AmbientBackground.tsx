import { useMemo } from "react";

type Props = { density?: number; petals?: boolean };

export function AmbientBackground({ density = 28, petals = true }: Props) {
  const sparkles = useMemo(
    () =>
      Array.from({ length: density }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 5,
        delay: Math.random() * 4,
        duration: 2.5 + Math.random() * 3,
      })),
    [density],
  );

  const floaters = useMemo(
    () =>
      petals
        ? Array.from({ length: 10 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            top: Math.random() * 100,
            delay: Math.random() * 6,
            duration: 8 + Math.random() * 8,
            emoji: ["🌸", "✨", "💜", "🪻"][i % 4],
            size: 14 + Math.random() * 18,
          }))
        : [],
    [petals],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-aurora" />
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white/90 animate-twinkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            boxShadow: "0 0 10px rgba(255,255,255,0.8)",
          }}
        />
      ))}
      {floaters.map((f) => (
        <span
          key={f.id}
          className="absolute animate-float select-none"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            fontSize: f.size,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
            opacity: 0.7,
            filter: "drop-shadow(0 4px 8px rgba(140,90,200,0.25))",
          }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
