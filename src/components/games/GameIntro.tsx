import { Link } from "@tanstack/react-router";

export default function GameIntro({
  level,
  title,
  emoji,
  tagline,
  rules,
  controls,
  goal,
  onStart,
}: {
  level: number;
  title: string;
  emoji: string;
  tagline: string;
  rules: string[];
  controls?: string[];
  goal: string;
  onStart: () => void;
}) {
  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 bg-sky overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/70 animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: 2 + Math.random() * 3,
              height: 2 + Math.random() * 3,
              animationDelay: `${Math.random() * 4}s`,
              boxShadow: "0 0 8px rgba(255,255,255,0.9)",
            }}
          />
        ))}
      </div>
      <div className="relative w-full max-w-md rounded-[2rem] glass shadow-glow p-6 sm:p-8 animate-[zoom-in_0.4s_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex items-center justify-between">
          <Link
            to="/map"
            className="inline-flex items-center gap-1 rounded-full glass px-3 py-1.5 text-xs font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
          >
            ← Map
          </Link>
          <span className="text-[10px] font-bold tracking-widest uppercase text-violet-deep/60">
            Level {level}
          </span>
        </div>

        <div className="mt-4 text-center">
          <div className="mx-auto size-20 rounded-full bg-button-grad flex items-center justify-center text-4xl shadow-glow animate-float">
            {emoji}
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gradient">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
        </div>

        <div className="mt-5 space-y-3">
          <Section title="How to play">
            <ul className="space-y-1.5">
              {rules.map((r, i) => (
                <li key={i} className="text-sm text-violet-deep/90 flex gap-2">
                  <span className="text-blossom">✦</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Section>

          {controls && controls.length > 0 && (
            <Section title="Controls">
              <ul className="space-y-1.5">
                {controls.map((c, i) => (
                  <li key={i} className="text-sm text-violet-deep/90 flex gap-2">
                    <span className="text-blossom">›</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Goal">
            <p className="text-sm text-violet-deep/90">{goal}</p>
          </Section>
        </div>

        <button
          onClick={onStart}
          className="mt-6 w-full rounded-full bg-button-grad px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-95 transition-transform"
        >
          Start 💜
        </button>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl glass p-3 shadow-soft">
      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-deep/60 mb-1.5">
        {title}
      </p>
      {children}
    </div>
  );
}
