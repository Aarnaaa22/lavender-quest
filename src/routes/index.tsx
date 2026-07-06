import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SparkleField } from "@/components/SparkleField";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lavender Adventure — A dreamy treasure hunt" },
      { name: "description", content: "Embark on a soft, sparkling treasure hunt across a lavender-hued island. Ten mini games await." },
      { property: "og:title", content: "Lavender Adventure" },
      { property: "og:description", content: "A dreamy interactive treasure hunt across a lavender island." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"intro" | "ready" | "leaving">("intro");

  useEffect(() => {
    const t = setTimeout(() => setPhase("ready"), 2200);
    return () => clearTimeout(t);
  }, []);

  const gatherParticles = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 200 + Math.random() * 380;
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          size: 3 + Math.random() * 5,
          delay: Math.random() * 0.6,
          hue: Math.random() > 0.5 ? "#e9d5ff" : "#fbcfe8",
        };
      }),
    [],
  );

  const burstParticles = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const angle = (i / 60) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 400 + Math.random() * 600;
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          size: 4 + Math.random() * 6,
          delay: Math.random() * 0.15,
        };
      }),
    [],
  );

  const handleStart = () => {
    if (phase === "leaving") return;
    setPhase("leaving");
    setTimeout(() => navigate({ to: "/map" }), 1100);
  };

  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-6 py-12">
      <AmbientBackground />

      {/* Intro gathering particles */}
      {phase === "intro" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          {gatherParticles.map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full la-gather"
              style={{
                width: p.size,
                height: p.size,
                background: p.hue,
                boxShadow: `0 0 12px ${p.hue}, 0 0 24px ${p.hue}`,
                ["--tx" as string]: `${p.x}px`,
                ["--ty" as string]: `${p.y}px`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Leaving burst */}
      {phase === "leaving" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          {burstParticles.map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full la-burst"
              style={{
                width: p.size,
                height: p.size,
                background: "white",
                boxShadow: "0 0 14px #f5d0fe, 0 0 28px #e9d5ff",
                ["--bx" as string]: `${p.x}px`,
                ["--by" as string]: `${p.y}px`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
          <div className="absolute inset-0 la-whiteout" />
        </div>
      )}

      <section
        className={`relative z-10 max-w-3xl text-center transition-all duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          phase === "leaving" ? "scale-150 opacity-0 blur-sm" : phase === "ready" ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <span
          className={`inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-violet-deep transition-all duration-700 ${
            phase === "ready" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
        >
          <span className="size-1.5 rounded-full bg-blossom animate-pulse-glow" />
          A dreamy treasure hunt
        </span>

        <h1 className="mt-6 text-5xl sm:text-7xl font-bold leading-[1.05] la-title">
          <span className="block la-title-line">Welcome to the</span>
          <span className="block la-title-line" style={{ animationDelay: "0.25s" }}>
            Lavender Adventure
          </span>
        </h1>

        <p
          className={`mt-6 text-lg text-muted-foreground max-w-xl mx-auto transition-all duration-700 delay-300 ${
            phase === "ready" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          Begin your adventure — sail a sparkling lilac sea, play ten enchanted little games,
          and uncover the moonlit treasure at the peak.
        </p>

        <div
          className={`mt-10 flex items-center justify-center gap-4 transition-all duration-700 delay-500 ${
            phase === "ready" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <button
            type="button"
            onClick={handleStart}
            className="group relative inline-flex items-center gap-2 rounded-full bg-button-grad px-9 py-4 text-base font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105 active:scale-95 la-cta"
          >
            <span className="relative z-10">Start Adventure</span>
            <span className="relative z-10 transition-transform group-hover:translate-x-1">→</span>
            <span aria-hidden className="absolute inset-0 rounded-full la-cta-glow" />
          </button>
        </div>

        <p
          className={`mt-10 text-xs text-muted-foreground/80 transition-opacity duration-700 delay-700 ${
            phase === "ready" ? "opacity-100" : "opacity-0"
          }`}
        >
          Crafted with 💜 — your progress is saved on this device.
        </p>
      </section>
    </main>
  );
}
