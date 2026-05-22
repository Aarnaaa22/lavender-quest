import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

type CardData = {
  id: number;
  pairId: number;
  flower: FlowerDef;
};

type FlowerDef = {
  emoji: string;
  hue: number; // for color shift
  shape: "round" | "pointy" | "soft";
  center: string;
};

// 10 pairs of subtly different lavender/purple flowers
const FLOWERS: FlowerDef[] = [
  { emoji: "🌸", hue: 295, shape: "round",  center: "#fde68a" },
  { emoji: "🌷", hue: 305, shape: "pointy", center: "#fbcfe8" },
  { emoji: "💜", hue: 285, shape: "round",  center: "#e9d5ff" },
  { emoji: "🪻", hue: 270, shape: "pointy", center: "#c4b5fd" },
  { emoji: "🌺", hue: 320, shape: "soft",   center: "#fcd34d" },
  { emoji: "🪷", hue: 310, shape: "round",  center: "#f5d0fe" },
  { emoji: "❀",  hue: 300, shape: "soft",   center: "#fde68a" },
  { emoji: "✿",  hue: 280, shape: "pointy", center: "#ddd6fe" },
  { emoji: "❁",  hue: 330, shape: "soft",   center: "#fbcfe8" },
  { emoji: "✾",  hue: 290, shape: "round",  center: "#e9d5ff" },
];

const TOTAL_TIME = 38; // seconds
const PEEK_TIME = 2600; // ms reveal at start
const WRONG_PENALTY = 2; // seconds
const FLIP_BACK_DELAY = 650; // ms

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): CardData[] {
  const deck: CardData[] = [];
  FLOWERS.forEach((f, i) => {
    deck.push({ id: i * 2, pairId: i, flower: f });
    deck.push({ id: i * 2 + 1, pairId: i, flower: f });
  });
  return shuffle(deck);
}

export default function PetalMeadow({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [deck, setDeck] = useState<CardData[]>(() => buildDeck());
  const [flipped, setFlipped] = useState<number[]>([]); // ids currently revealed (selection)
  const [matched, setMatched] = useState<Set<number>>(new Set()); // pairIds
  const [shakeIds, setShakeIds] = useState<number[]>([]);
  const [sparkleAt, setSparkleAt] = useState<{ id: number; x: number; y: number } | null>(null);
  const [peeking, setPeeking] = useState(true);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [shuffleNudge, setShuffleNudge] = useState(0); // re-render trigger to apply micro shifts
  const lockRef = useRef(false);
  const movesRef = useRef(0);
  const wonRef = useRef(false);

  // Initial peek
  useEffect(() => {
    const t = setTimeout(() => setPeeking(false), PEEK_TIME);
    return () => clearTimeout(t);
  }, []);

  // Countdown
  useEffect(() => {
    if (peeking || status !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setStatus("lost");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [peeking, status]);

  // Win check
  useEffect(() => {
    if (matched.size === FLOWERS.length && !wonRef.current) {
      wonRef.current = true;
      setStatus("won");
      onWin();
    }
  }, [matched, onWin]);

  const handleFlip = useCallback((card: CardData, e: React.MouseEvent) => {
    if (lockRef.current || peeking || status !== "playing") return;
    if (matched.has(card.pairId)) return;
    if (flipped.includes(card.id)) return;
    if (flipped.length >= 2) return;

    const nextFlipped = [...flipped, card.id];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      movesRef.current += 1;
      const [aId, bId] = nextFlipped;
      const a = deck.find((c) => c.id === aId)!;
      const b = deck.find((c) => c.id === bId)!;
      if (a.pairId === b.pairId) {
        // Match
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setSparkleAt({ id: Date.now(), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        setTimeout(() => setSparkleAt(null), 800);
        setTimeout(() => {
          setMatched((m) => new Set(m).add(a.pairId));
          setFlipped([]);
        }, 320);
      } else {
        // Wrong
        lockRef.current = true;
        setShakeIds([aId, bId]);
        setWrongAttempts((w) => w + 1);
        setTimeLeft((t) => Math.max(0, t - WRONG_PENALTY));
        setTimeout(() => {
          setFlipped([]);
          setShakeIds([]);
          lockRef.current = false;
        }, FLIP_BACK_DELAY);
      }

      // Distraction: micro-shift positions every 3 moves
      if (movesRef.current > 0 && movesRef.current % 3 === 0) {
        setShuffleNudge((n) => n + 1);
      }
    }
  }, [flipped, matched, peeking, status, deck]);

  // Per-card jitter offsets (recomputed each shuffleNudge)
  const offsets = useMemo(() => {
    return deck.map(() => ({
      dx: (Math.random() - 0.5) * 10,
      dy: (Math.random() - 0.5) * 10,
      rot: (Math.random() - 0.5) * 4,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffleNudge, deck]);

  const reset = () => {
    setDeck(buildDeck());
    setFlipped([]);
    setMatched(new Set());
    setShakeIds([]);
    setSparkleAt(null);
    setPeeking(true);
    setTimeLeft(TOTAL_TIME);
    setStatus("playing");
    setWrongAttempts(0);
    setShuffleNudge(0);
    wonRef.current = false;
    movesRef.current = 0;
    setTimeout(() => setPeeking(false), PEEK_TIME);
  };

  const timePct = (timeLeft / TOTAL_TIME) * 100;
  const timeLow = timeLeft <= 10;

  return (
    <main className="relative min-h-screen overflow-hidden petal-meadow-bg">
      {/* Moving grass */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-48 z-0">
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-70">
          <path className="grass-1" d="M0,140 C320,80 720,180 1440,120 L1440,200 L0,200 Z" fill="oklch(0.65 0.14 145 / 0.45)" />
        </svg>
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-60">
          <path className="grass-2" d="M0,160 C400,100 980,200 1440,150 L1440,200 L0,200 Z" fill="oklch(0.55 0.16 140 / 0.5)" />
        </svg>
      </div>

      {/* Floating petals (distraction) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="petal-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-${Math.random() * 30}%`,
              fontSize: `${14 + Math.random() * 18}px`,
              animationDuration: `${10 + Math.random() * 12}s`,
              animationDelay: `${Math.random() * 8}s`,
              filter: `hue-rotate(${Math.random() * 40 - 20}deg)`,
            }}
          >
            {Math.random() > 0.5 ? "🌸" : "💜"}
          </span>
        ))}
      </div>

      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between gap-3 p-4 sm:p-6">
        <Link
          to="/map"
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
        >
          ← Map
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full glass px-3 sm:px-4 py-2 shadow-soft">
            <span className="text-xs font-semibold text-violet-deep/70">Matches </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{matched.size}</span>
            <span className="text-xs font-semibold text-violet-deep/70"> / {FLOWERS.length}</span>
          </div>
          <div className={`rounded-full glass px-3 sm:px-4 py-2 shadow-soft transition-colors ${timeLow ? "ring-2 ring-rose-400/70 animate-pulse" : ""}`}>
            <span className="text-xs font-semibold text-violet-deep/70">Time </span>
            <span className={`text-sm font-bold tabular-nums ${timeLow ? "text-rose-500" : "text-violet-deep"}`}>{timeLeft}s</span>
          </div>
        </div>
      </header>

      {/* Time bar */}
      <div className="relative z-20 mx-auto max-w-md px-6">
        <div className="h-2 rounded-full glass overflow-hidden">
          <div
            className={`h-full transition-all duration-500 shadow-glow ${timeLow ? "bg-gradient-to-r from-rose-400 to-pink-500" : "bg-button-grad"}`}
            style={{ width: `${timePct}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs font-semibold text-violet-deep/70 tracking-wide">
          Level {levelId} · Petal Meadow 🌸 {peeking && <span className="ml-1">— memorize!</span>}
        </p>
      </div>

      {/* Grid */}
      <div className="relative z-20 mx-auto mt-4 sm:mt-6 px-3 sm:px-6 pb-32 max-w-3xl">
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {deck.map((card, idx) => {
            const isFlipped = peeking || flipped.includes(card.id) || matched.has(card.pairId);
            const isMatched = matched.has(card.pairId);
            const isShaking = shakeIds.includes(card.id);
            const o = offsets[idx];
            return (
              <button
                key={card.id}
                onClick={(e) => handleFlip(card, e)}
                disabled={isMatched || lockRef.current || peeking || status !== "playing"}
                aria-label="Flower card"
                className={`petal-card ${isFlipped ? "is-flipped" : ""} ${isMatched ? "is-matched" : ""} ${isShaking ? "is-shake" : ""}`}
                style={{
                  transform: `translate(${o?.dx ?? 0}px, ${o?.dy ?? 0}px) rotate(${o?.rot ?? 0}deg)`,
                  transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                <span className="petal-card-inner">
                  <span className="petal-card-face petal-card-back">
                    <span className="petal-card-back-emblem">✦</span>
                  </span>
                  <span
                    className="petal-card-face petal-card-front"
                    style={{
                      background: `radial-gradient(circle at 50% 55%, ${card.flower.center}, oklch(0.92 0.08 ${card.flower.hue}) 55%, oklch(0.78 0.14 ${card.flower.hue}) 100%)`,
                    }}
                  >
                    <span className="petal-card-emoji" style={{ filter: `hue-rotate(${card.flower.hue - 300}deg)` }}>
                      {card.flower.emoji}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sparkle burst on match */}
      {sparkleAt && (
        <span
          aria-hidden
          className="pointer-events-none fixed z-40 pop-burst"
          style={{ left: sparkleAt.x, top: sparkleAt.y }}
        />
      )}

      {/* End modal */}
      {status !== "playing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-violet-deep/40 backdrop-blur-md animate-[fade-up_0.4s_ease-out]">
          <div className="relative w-full max-w-md rounded-[2rem] glass shadow-glow p-8 sm:p-10 text-center animate-[zoom-in_0.5s_cubic-bezier(0.16,1,0.3,1)]">
            <div className={`mx-auto size-24 rounded-full flex items-center justify-center text-5xl shadow-glow animate-float ${status === "won" ? "bg-button-grad" : "bg-gradient-to-br from-rose-400 to-pink-500"}`}>
              {status === "won" ? "💜" : "🥀"}
            </div>
            <h2 className="mt-6 text-3xl sm:text-4xl font-bold text-gradient">
              {status === "won" ? "Meadow Cleared" : "Try Again"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {status === "won"
                ? `You matched every flower with ${timeLeft}s to spare.`
                : "The petals scattered before you could match them all."}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Stat label="Matches" value={`${matched.size}/${FLOWERS.length}`} />
              <Stat label="Wrong" value={String(wrongAttempts)} />
              <Stat label="Time left" value={`${timeLeft}s`} />
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <button
                onClick={reset}
                className="flex-1 rounded-full glass px-6 py-3 text-sm font-bold text-violet-deep hover:scale-[1.02] active:scale-95 transition-transform shadow-soft"
              >
                ↺ Replay
              </button>
              <button
                onClick={onReturn}
                className="flex-1 rounded-full bg-button-grad px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Return to Map →
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl glass px-2 py-3 shadow-soft">
      <p className="text-[10px] uppercase tracking-widest font-bold text-violet-deep/60">{label}</p>
      <p className="mt-1 text-lg font-bold text-violet-deep tabular-nums">{value}</p>
    </div>
  );
}
