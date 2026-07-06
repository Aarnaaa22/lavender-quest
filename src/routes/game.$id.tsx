import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { LEVELS, TOTAL_LEVELS } from "@/lib/levels";
import { completeLevel, loadProgress, skipLevel } from "@/lib/storage";
import PetalMeadow from "@/components/games/PetalMeadow";
import ButterflyDrift from "@/components/games/ButterflyDrift";
import BerryRush from "@/components/games/BerryRush";
import LotusMaze from "@/components/games/LotusMaze";
import ShellGarland from "@/components/games/ShellGarland";
import ShapeShift from "@/components/games/ShapeShift";
import GameIntro from "@/components/games/GameIntro";
import { GameHeader } from "@/components/GameHeader";

type PlaneFlight = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  dx: string;
  dy: string;
  nextLevel: number;
};

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
  x: number;
  size: number;
  drift: number;
  duration: number;
  rare: boolean;
  bomb: boolean;
  popped: boolean;
};

type Pop = { id: number; x: number; y: number; bomb?: boolean };

const TARGET = 25;
const BB_TIME = 35;

const INTROS: Record<number, Parameters<typeof GameIntro>[0]> = {
  1: {
    level: 1, title: "Bubble Beach", emoji: "🫧",
    tagline: "Pop bubbles. Dodge the spiky ones.",
    rules: [
      "Tap bubbles to pop them and earn points.",
      "Glowing rare bubbles are worth 3 points.",
      "🦔 Spiny urchin bubbles end the run instantly — DO NOT pop them.",
    ],
    controls: ["Tap / click bubbles"],
    goal: `Reach ${TARGET} points before time runs out.`,
    onStart: () => {},
  },
  2: {
    level: 2, title: "Petal Meadow", emoji: "🌸",
    tagline: "Memory under pressure.",
    rules: [
      "Cards are revealed briefly — memorize them.",
      "Flip two cards to find matching flowers.",
      "Wrong matches cost 2 seconds.",
      "Cards subtly shift to confuse you.",
    ],
    controls: ["Click cards"],
    goal: "Match all 10 pairs before time runs out.",
    onStart: () => {},
  },
  3: {
    level: 3, title: "Butterfly Net", emoji: "🦋",
    tagline: "Net, carry, and basket.",
    rules: [
      "Move the net to catch a butterfly, then carry it to the basket.",
      "Only one butterfly can be held at once.",
      "Rare glowing butterflies are faster and worth 3 points.",
    ],
    controls: ["Move the mouse or drag the net","Drop in the basket to score"],
    goal: `Catch ${TARGET} butterflies before time runs out.`,
    onStart: () => {},
  },
  4: {
    level: 4, title: "Berry Rush", emoji: "🍇",
    tagline: "Movement & control.",
    rules: [
      "You auto-run along three lanes.",
      "Collect 🍇 berries (and rare 🫐 for 3 pts).",
      "Avoid 🪨 rocks, 🌿 bushes, and 💧 puddles.",
      "Jump to leap over rocks & bushes (puddles need lane change).",
    ],
    controls: [
      "↑ / ↓ arrows (or ← →) to switch lanes",
      "Tap Space bar to jump",
      "Mobile: swipe up/down to switch lanes, tap to jump",
    ],
    goal: "Hit the score target OR survive the timer with health left.",
    onStart: () => {},
  },
  5: {
    level: 5, title: "Lotus Maze", emoji: "🌸",
    tagline: "Exploration & focus.",
    rules: [
      "Navigate the dreamy lavender maze to reach the glowing lotus.",
      "Only the area around you is clearly visible — the rest is dim.",
      "You have 3 hints — each briefly lights the path to the lotus.",
      "A random maze is chosen every run.",
    ],
    controls: [
      "Arrow keys or WASD to move",
      "Mobile: swipe or tap the on-screen D-pad",
    ],
    goal: "Reach the lotus before the timer runs out.",
    onStart: () => {},
  },
  6: {
    level: 6, title: "Tap the Odd One", emoji: "💜",
    tagline: "Spot the subtle odd item in the lavender grid.",
    rules: [
      "Click the one item that looks slightly different.",
      "Correct taps increase your score and generate a new grid.",
      "Wrong taps subtract a little time.",
      "Keep the pace fast and your eyes sharp.",
    ],
    controls: ["Click the odd item"],
    goal: "Score as many correct taps as possible before time runs out.",
    onStart: () => {},
  },
  7: {
    level: 7, title: "Shell Garland", emoji: "🐚",
    tagline: "Rebuild the lavender beach garland with shells and charms.",
    rules: [
      "Match the exact target garland pattern using the pieces below.",
      "Drag shells and charms into the empty slots on the string.",
      "Correct placements glow softly; wrong drops reject with a shake.",
      "The pattern randomizes each new game.",
    ],
    controls: ["Drag and drop items into slots"],
    goal: "Recreate the full garland pattern before the timer ends.",
    onStart: () => {},
  },
};

function GamePage() {
  const { id } = Route.useParams();
  const levelId = Number(id);
  const level = LEVELS.find((l) => l.id === levelId);
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [credits, setCredits] = useState(5);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [planeFlight, setPlaneFlight] = useState<PlaneFlight | null>(null);
  const actionHandledRef = useRef(false);
  const planeTimeoutRef = useRef<number | null>(null);
  const planeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setStarted(false);
    setFeedback(null);
    setShowSkipConfirm(false);
    setIsFinished(false);
    setPlaneFlight(null);
    actionHandledRef.current = false;
    const progress = loadProgress();
    setCredits(progress.credits);

    return () => {
      if (planeTimeoutRef.current) window.clearTimeout(planeTimeoutRef.current);
    };
  }, [levelId]);

  const buildPlaneFlight = useCallback(
    (fromLevel: number, toLevel: number): PlaneFlight | null => {
      const current = LEVELS.find((l) => l.id === fromLevel);
      const next = LEVELS.find((l) => l.id === toLevel);
      if (!current || !next || !planeContainerRef.current) return null;

      const bounds = planeContainerRef.current.getBoundingClientRect();
      const fromPx = { x: (current.x / 100) * bounds.width, y: (current.y / 100) * bounds.height };
      const toPx = { x: (next.x / 100) * bounds.width, y: (next.y / 100) * bounds.height };
      return {
        from: { x: current.x, y: current.y },
        to: { x: next.x, y: next.y },
        dx: `${toPx.x - fromPx.x}px`,
        dy: `${toPx.y - fromPx.y}px`,
        nextLevel: toLevel,
      };
    },
    [],
  );

  const onReturn = useCallback(() => navigate({ to: "/map" }), [navigate]);

  const confirmSkip = useCallback(() => {
    if (actionHandledRef.current) return;
    if (credits < 5) {
      setFeedback("Not enough credits to skip");
      setShowSkipConfirm(false);
      return;
    }

    actionHandledRef.current = true;
    const nextProgress = skipLevel(levelId, TOTAL_LEVELS);
    setCredits(nextProgress.credits);
    setFeedback("Level skipped! -5 credits");
    setShowSkipConfirm(false);

    if (levelId === TOTAL_LEVELS) {
      setIsFinished(true);
      return;
    }

    navigate({ to: "/game/$id", params: { id: String(levelId + 1) } });
  }, [credits, levelId, navigate]);

  const onWin = useCallback(() => {
    if (actionHandledRef.current) return;
    actionHandledRef.current = true;
    const nextProgress = completeLevel(levelId, TOTAL_LEVELS);
    setCredits(nextProgress.credits);
    setFeedback("Level completed! +3 credits");

    if (levelId === TOTAL_LEVELS) {
      setIsFinished(true);
      return;
    }

    const flight = buildPlaneFlight(levelId, levelId + 1);
    if (!flight) {
      navigate({ to: "/game/$id", params: { id: String(levelId + 1) } });
      return;
    }

    setPlaneFlight(flight);
    planeTimeoutRef.current = window.setTimeout(() => {
      setPlaneFlight(null);
      navigate({ to: "/game/$id", params: { id: String(levelId + 1) } });
    }, 1100);
  }, [buildPlaneFlight, levelId, navigate]);

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

  const intro = INTROS[levelId];
  const skipHelperText = credits < 5 ? "Not enough credits to skip" : "Skip this level for -5 credits";

  const pageContent = (() => {
    if (!started && intro) {
      return <GameIntro {...intro} onStart={() => setStarted(true)} />;
    }

    if (isFinished) {
      return (
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center rounded-[2rem] bg-white/80 p-8 text-center shadow-glow">
          <div className="mb-4 text-5xl">🌙</div>
          <h2 className="text-3xl font-bold text-gradient">Adventure complete!</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            You reached the end of the lavender quest. Your credits and progress are safely saved for your next visit.
          </p>
          <Link to="/map" className="mt-6 inline-block rounded-full bg-button-grad px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow">
            Return to the map
          </Link>
        </div>
      );
    }

    
    if (levelId === 2) return <PetalMeadow levelId={levelId} onWin={onWin} onReturn={onReturn} />;
    if (levelId === 3) return <ButterflyDrift levelId={levelId} onWin={onWin} onReturn={onReturn} />;
    if (levelId === 4) return <BerryRush levelId={levelId} onWin={onWin} onReturn={onReturn} />;
    if (levelId === 5) return <LotusMaze levelId={levelId} onWin={onWin} onReturn={onReturn} />;
    if (levelId === 6) return <ShapeShift levelId={levelId} onWin={onWin} onReturn={onReturn} />;
    if (levelId === 7) return <ShellGarland levelId={levelId} onWin={onWin} onReturn={onReturn} />;

    return <ComingSoon levelName={level.name} game={level.game} />;
  })();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_45%),linear-gradient(135deg,_#f7e9ff_0%,_#d4c8ff_100%)] text-violet-deep">
      <GameHeader
        credits={credits}
        title={level.name}
        onSkip={() => setShowSkipConfirm(true)}
        skipDisabled={credits < 5}
        skipLabel="Skip this level (-5)"
        helperText={feedback ?? skipHelperText}
      />

      {showSkipConfirm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-violet-deep/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white/90 p-8 text-center shadow-glow">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-500">Skip level</p>
            <h3 className="mt-3 text-2xl font-bold text-violet-deep">Are you sure you want to skip this level? -5 credits</h3>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={confirmSkip}
                className="rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-glow"
              >
                Skip level
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSkipConfirm(false);
                  setFeedback(null);
                }}
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-violet-deep shadow-glow"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div ref={planeContainerRef} className="mx-auto max-w-6xl px-4 py-6 sm:px-6 relative">
        {pageContent}

        {planeFlight ? (
          <div className="pointer-events-none absolute inset-0 z-40">
            <svg className="absolute inset-0 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line
                x1={planeFlight.from.x}
                y1={planeFlight.from.y}
                x2={planeFlight.to.x}
                y2={planeFlight.to.y}
                stroke="rgba(255, 105, 180, 0.85)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            </svg>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 text-3xl animate-plane-flight"
              style={{
                left: `${planeFlight.from.x}%`,
                top: `${planeFlight.from.y}%`,
                "--dx": planeFlight.dx,
                "--dy": planeFlight.dy,
              } as React.CSSProperties}
            >
              ✈️
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
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
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [timeLeft, setTimeLeft] = useState(BB_TIME);
  const idRef = useRef(0);
  const doneRef = useRef(false);

  // Spawn bubbles
  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => {
      setBubbles((prev) => {
        if (prev.length > 22) return prev;
        const roll = Math.random();
        const bomb = roll < 0.14;
        const rare = !bomb && roll > 0.92;
        const next: Bubble = {
          id: idRef.current++,
          x: 5 + Math.random() * 90,
          size: bomb ? 55 + Math.random() * 25 : rare ? 70 + Math.random() * 20 : 40 + Math.random() * 50,
          drift: (Math.random() - 0.5) * 30,
          duration: bomb ? 6 + Math.random() * 3 : 8 + Math.random() * 6,
          rare,
          bomb,
          popped: false,
        };
        return [...prev, next];
      });
    }, 520);
    return () => clearInterval(interval);
  }, [status]);

  // Timer
  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          if (!doneRef.current) {
            doneRef.current = true;
            setStatus("lost");
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  // Cleanup popped
  useEffect(() => {
    const t = setInterval(() => {
      setBubbles((prev) => prev.filter((b) => !b.popped));
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const pop = useCallback((b: Bubble, e: React.MouseEvent | React.TouchEvent) => {
    if (b.popped || doneRef.current) return;
    setBubbles((prev) => prev.map((p) => (p.id === b.id ? { ...p, popped: true } : p)));
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const popId = Date.now() + Math.random();
    setPops((prev) => [...prev, { id: popId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, bomb: b.bomb }]);
    setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== popId)), 700);

    if (b.bomb) {
      doneRef.current = true;
      setStatus("lost");
      return;
    }

    setScore((s) => {
      const inc = b.rare ? 3 : 1;
      const next = s + inc;
      if (next >= TARGET && !doneRef.current) {
        doneRef.current = true;
        setStatus("won");
        onWin();
      }
      return Math.min(next, TARGET);
    });
  }, [onWin]);

  const reset = () => {
    setScore(0);
    setBubbles([]);
    setPops([]);
    setTimeLeft(BB_TIME);
    setStatus("playing");
    doneRef.current = false;
  };

  const progress = Math.min(100, (score / TARGET) * 100);
  const timeLow = timeLeft <= 10;

  return (
    <main className="relative min-h-screen overflow-hidden bubble-beach-bg">
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

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 z-0">
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-60">
          <path className="wave-1" d="M0,100 C360,160 1080,40 1440,100 L1440,200 L0,200 Z" fill="oklch(0.85 0.1 320 / 0.6)" />
        </svg>
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-50">
          <path className="wave-2" d="M0,120 C400,60 1040,180 1440,120 L1440,200 L0,200 Z" fill="oklch(0.78 0.13 295 / 0.55)" />
        </svg>
      </div>

      <header className="relative z-20 flex items-center justify-between gap-3 p-4 sm:p-6">
        <Link
          to="/map"
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
        >
          ← Map
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full glass px-3 sm:px-4 py-2 shadow-soft">
            <span className="text-xs font-semibold text-violet-deep/70">Score </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{score}</span>
            <span className="text-xs font-semibold text-violet-deep/70">/{TARGET}</span>
          </div>
          <div className={`rounded-full glass px-3 sm:px-4 py-2 shadow-soft ${timeLow ? "ring-2 ring-rose-400/70 animate-pulse" : ""}`}>
            <span className="text-xs font-semibold text-violet-deep/70">⏱ </span>
            <span className={`text-sm font-bold tabular-nums ${timeLow ? "text-rose-500" : "text-violet-deep"}`}>{timeLeft}s</span>
          </div>
        </div>
      </header>

      <div className="relative z-20 mx-auto max-w-md px-6">
        <div className="h-2 rounded-full glass overflow-hidden">
          <div
            className="h-full bg-button-grad transition-all duration-500 shadow-glow"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs font-semibold text-violet-deep/70 tracking-wide">
          Level {levelId} · Bubble Beach 🫧 — avoid the spiny ones!
        </p>
      </div>

      <div className="absolute inset-0 z-10 overflow-hidden">
        {bubbles.map((b) => (
          <button
            key={b.id}
            onClick={(e) => pop(b, e)}
            onTouchStart={(e) => pop(b, e)}
            disabled={b.popped || status !== "playing"}
            aria-label={b.bomb ? "Spiny bubble — danger" : b.rare ? "Rare glowing bubble" : "Bubble"}
            className={`bubble ${b.popped ? "bubble-pop" : ""} ${b.rare ? "bubble-rare" : ""} ${b.bomb ? "bubble-bomb" : ""}`}
            style={{
              left: `${b.x}%`,
              width: b.size,
              height: b.size,
              animationDuration: `${b.duration}s`,
              ["--drift" as string]: `${b.drift}vw`,
            }}
          >
            {b.bomb ? <span className="bubble-spike">🦔</span> : <span className="bubble-shine" />}
          </button>
        ))}
      </div>

      <div aria-hidden className="pointer-events-none fixed inset-0 z-30">
        {pops.map((p) => (
          <span
            key={p.id}
            className={p.bomb ? "pop-burst-bomb" : "pop-burst"}
            style={{ left: p.x, top: p.y }}
          />
        ))}
      </div>

      {status !== "playing" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-violet-deep/40 backdrop-blur-md animate-[fade-up_0.4s_ease-out]">
          <div className="relative w-full max-w-md rounded-[2rem] glass shadow-glow p-8 sm:p-10 text-center animate-[zoom-in_0.5s_cubic-bezier(0.16,1,0.3,1)]">
            <div className={`mx-auto size-24 rounded-full flex items-center justify-center text-5xl shadow-glow animate-float ${status === "won" ? "bg-button-grad" : "bg-gradient-to-br from-rose-400 to-pink-500"}`}>
              {status === "won" ? "💜" : "🦔"}
            </div>
            <h2 className="mt-6 text-3xl sm:text-4xl font-bold text-gradient">
              {status === "won" ? "Level Complete" : "Ouch!"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {status === "won"
                ? `You popped ${score} points worth of bubbles.`
                : timeLeft === 0
                  ? "Time's up — try again!"
                  : "You popped a spiny one. Watch out for those!"}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <button
                onClick={reset}
                className="flex-1 rounded-full glass px-6 py-3 text-sm font-bold text-violet-deep hover:scale-[1.02] active:scale-95 transition-transform shadow-soft"
              >↺ Replay</button>
              <button
                onClick={onReturn}
                className="flex-1 rounded-full bg-button-grad px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-95 transition-transform"
              >Return to Map →</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
