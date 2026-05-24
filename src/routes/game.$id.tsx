import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { LEVELS, TOTAL_LEVELS } from "@/lib/levels";
import { completeLevel } from "@/lib/storage";
import PetalMeadow from "@/components/games/PetalMeadow";
import ButterflyDrift from "@/components/games/ButterflyDrift";
import BerryRush from "@/components/games/BerryRush";

export const Route = createFileRoute("/game/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Level ${params.id} — Lavender Adventure` },
      { name: "description", content: "Play a dreamy lavender mini game." },
    ],
  }),
  component: GamePage,
});

type Bubble = {
  id: number;
  x: number; // %
  size: number;
  drift: number;
  duration: number;
  rare: boolean;
  popped: boolean;
};

type Pop = { id: number; x: number; y: number };

const TARGET = 15;

function GamePage() {
  const { id } = Route.useParams();
  const levelId = Number(id);
  const level = LEVELS.find((l) => l.id === levelId);
  const navigate = useNavigate();

  if (!level) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Level not found</h1>
          <Link to="/map" className="mt-6 inline-block rounded-full bg-button-grad px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow">
            Back to map
          </Link>
        </div>
      </main>
    );
  }

  if (levelId === 1) {
    return <BubbleBeach levelId={levelId} onWin={() => {
      completeLevel(levelId, TOTAL_LEVELS);
    }} onReturn={() => navigate({ to: "/map" })} />;
  }

  if (levelId === 2) {
    return <PetalMeadow levelId={levelId} onWin={() => {
      completeLevel(levelId, TOTAL_LEVELS);
    }} onReturn={() => navigate({ to: "/map" })} />;
  }

  if (levelId === 3) {
    return <ButterflyDrift levelId={levelId} onWin={() => {
      completeLevel(levelId, TOTAL_LEVELS);
    }} onReturn={() => navigate({ to: "/map" })} />;
  }

  if (levelId === 4) {
    return <BerryRush levelId={levelId} onWin={() => {
      completeLevel(levelId, TOTAL_LEVELS);
    }} onReturn={() => navigate({ to: "/map" })} />;
  }

  return <ComingSoon levelName={level.name} game={level.game} />;
}

function ComingSoon({ levelName, game }: { levelName: string; game: string }) {
  return (
    <main className="relative min-h-screen flex items-center justify-center p-8 text-center bg-sky">
      <div className="glass rounded-[2rem] p-10 max-w-md shadow-glow">
        <div className="text-5xl mb-4">🚧</div>
        <p className="text-xs font-bold tracking-widest uppercase text-violet-deep/70">{levelName}</p>
        <h1 className="mt-2 text-3xl font-bold text-gradient">{game}</h1>
        <p className="mt-3 text-sm text-muted-foreground">This mini game is still being dreamed up.</p>
        <Link to="/map" className="mt-6 inline-block rounded-full bg-button-grad px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow hover:scale-105 transition-transform">
          ← Back to map
        </Link>
      </div>
    </main>
  );
}

function BubbleBeach({ levelId, onWin, onReturn }: { levelId: number; onWin: () => void; onReturn: () => void }) {
  const [score, setScore] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [won, setWon] = useState(false);
  const idRef = useRef(0);
  const wonRef = useRef(false);

  // Spawn bubbles
  useEffect(() => {
    if (won) return;
    const interval = setInterval(() => {
      setBubbles((prev) => {
        // cap to avoid clutter
        if (prev.length > 18) return prev;
        const rare = Math.random() < 0.08;
        const next: Bubble = {
          id: idRef.current++,
          x: 5 + Math.random() * 90,
          size: rare ? 70 + Math.random() * 20 : 40 + Math.random() * 50,
          drift: (Math.random() - 0.5) * 30,
          duration: 8 + Math.random() * 6,
          rare,
          popped: false,
        };
        return [...prev, next];
      });
    }, 650);
    return () => clearInterval(interval);
  }, [won]);

  // Cleanup off-screen bubbles
  useEffect(() => {
    const t = setInterval(() => {
      setBubbles((prev) => prev.filter((b) => !b.popped));
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const pop = useCallback((b: Bubble, e: React.MouseEvent | React.TouchEvent) => {
    if (b.popped || wonRef.current) return;
    setBubbles((prev) => prev.map((p) => (p.id === b.id ? { ...p, popped: true } : p)));
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const popId = Date.now() + Math.random();
    setPops((prev) => [...prev, { id: popId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }]);
    setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== popId)), 700);

    setScore((s) => {
      const inc = b.rare ? 3 : 1;
      const next = s + inc;
      if (next >= TARGET && !wonRef.current) {
        wonRef.current = true;
        setWon(true);
        onWin();
      }
      return Math.min(next, TARGET);
    });
  }, [onWin]);

  const progress = Math.min(100, (score / TARGET) * 100);

  return (
    <main className="relative min-h-screen overflow-hidden bubble-beach-bg">
      {/* Sparkles */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/80 animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: 2 + Math.random() * 3,
              height: 2 + Math.random() * 3,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
              boxShadow: "0 0 8px rgba(255,255,255,0.9)",
            }}
          />
        ))}
      </div>

      {/* Waves at bottom */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 z-0">
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-60">
          <path className="wave-1" d="M0,100 C360,160 1080,40 1440,100 L1440,200 L0,200 Z" fill="oklch(0.85 0.1 320 / 0.6)" />
        </svg>
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-50">
          <path className="wave-2" d="M0,120 C400,60 1040,180 1440,120 L1440,200 L0,200 Z" fill="oklch(0.78 0.13 295 / 0.55)" />
        </svg>
      </div>

      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between gap-3 p-4 sm:p-6">
        <Link
          to="/map"
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
        >
          ← Map
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-full glass px-4 py-2 shadow-soft">
            <span className="text-xs font-semibold text-violet-deep/70">Score </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{score}</span>
            <span className="text-xs font-semibold text-violet-deep/70"> / Goal </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{TARGET}</span>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="relative z-20 mx-auto max-w-md px-6">
        <div className="h-2 rounded-full glass overflow-hidden">
          <div
            className="h-full bg-button-grad transition-all duration-500 shadow-glow"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs font-semibold text-violet-deep/70 tracking-wide">
          Level {levelId} · Bubble Beach 🫧
        </p>
      </div>

      {/* Bubbles */}
      <div className="absolute inset-0 z-10 overflow-hidden">
        {bubbles.map((b) => (
          <button
            key={b.id}
            onClick={(e) => pop(b, e)}
            onTouchStart={(e) => pop(b, e)}
            disabled={b.popped}
            aria-label={b.rare ? "Rare glowing bubble" : "Bubble"}
            className={`bubble ${b.popped ? "bubble-pop" : ""} ${b.rare ? "bubble-rare" : ""}`}
            style={{
              left: `${b.x}%`,
              width: b.size,
              height: b.size,
              animationDuration: `${b.duration}s`,
              ["--drift" as string]: `${b.drift}vw`,
            }}
          >
            <span className="bubble-shine" />
          </button>
        ))}
      </div>

      {/* Pop bursts (fixed positioning relative to viewport) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-30">
        {pops.map((p) => (
          <span
            key={p.id}
            className="pop-burst"
            style={{ left: p.x, top: p.y }}
          />
        ))}
      </div>

      {/* Win modal */}
      {won && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-violet-deep/40 backdrop-blur-md animate-[fade-up_0.4s_ease-out]">
          <div className="relative w-full max-w-md rounded-[2rem] glass shadow-glow p-10 text-center animate-[zoom-in_0.5s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="mx-auto size-24 rounded-full bg-button-grad flex items-center justify-center text-5xl shadow-glow animate-float">
              💜
            </div>
            <h2 className="mt-6 text-4xl font-bold text-gradient">Level Complete</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Beautiful! You popped your way through the bubble beach.
            </p>
            <button
              onClick={onReturn}
              className="mt-7 w-full rounded-full bg-button-grad px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-95 transition-transform"
            >
              Return to Map →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
