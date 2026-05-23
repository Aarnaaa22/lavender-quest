import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Speed = "slow" | "med" | "fast";
type Butterfly = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: Speed;
  hue: number;
  size: number;
  rare: boolean;
  caught: boolean;
  phase: number;
  wobbleAmp: number;
  nextTurn: number;
  rot: number;
};

type Sparkle = { id: number; x: number; y: number };

const TARGET = 13;
const TIME_LIMIT = 28;
const MAX_ALIVE = 7;

function makeButterfly(id: number, forceRare = false): Butterfly {
  const r = Math.random();
  const speed: Speed = forceRare ? "fast" : r < 0.35 ? "slow" : r < 0.8 ? "med" : "fast";
  const baseSpeed = speed === "slow" ? 9 : speed === "med" ? 16 : 24;
  const angle = Math.random() * Math.PI * 2;
  const rare = forceRare;
  return {
    id,
    x: 10 + Math.random() * 80,
    y: 15 + Math.random() * 70,
    vx: Math.cos(angle) * baseSpeed,
    vy: Math.sin(angle) * baseSpeed * 0.6,
    speed,
    hue: 270 + Math.random() * 60,
    size: rare ? 64 : speed === "slow" ? 56 : speed === "med" ? 48 : 40,
    rare,
    caught: false,
    phase: Math.random() * Math.PI * 2,
    wobbleAmp: 8 + Math.random() * 10,
    nextTurn: 0.8 + Math.random() * 1.6,
    rot: 0,
  };
}

export default function ButterflyDrift({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [butterflies, setButterflies] = useState<Butterfly[]>(() =>
    Array.from({ length: 5 }, (_, i) => makeButterfly(i))
  );
  const [score, setScore] = useState(0);
  const [caughtCount, setCaughtCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  const idRef = useRef(100);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(performance.now());
  const statusRef = useRef(status);
  statusRef.current = status;
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;

  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => {
      setButterflies((prev) => {
        const alive = prev.filter((b) => !b.caught);
        if (alive.length >= MAX_ALIVE) return prev;
        const wantRare = !alive.some((b) => b.rare) && Math.random() < 0.18;
        return [...alive, makeButterfly(idRef.current++, wantRare)];
      });
    }, 900);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setStatus((cur) => (cur === "playing" ? "lost" : cur));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== "playing") return;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      setButterflies((prev) =>
        prev.map((b) => {
          if (b.caught) return b;
          let { vx, vy, x, y, nextTurn, phase } = b;
          nextTurn -= dt;
          if (nextTurn <= 0) {
            const ang = Math.atan2(vy, vx) + (Math.random() - 0.5) * 1.2;
            const mag = Math.hypot(vx, vy);
            vx = Math.cos(ang) * mag;
            vy = Math.sin(ang) * mag * 0.85;
            nextTurn = 0.6 + Math.random() * 1.8;
          }
          phase += dt * 3;
          const wobbleX = Math.sin(phase) * b.wobbleAmp * dt;
          const wobbleY = Math.cos(phase * 1.3) * b.wobbleAmp * 0.6 * dt;
          x += vx * dt + wobbleX;
          y += vy * dt + wobbleY;
          if (x < 4) { x = 4; vx = Math.abs(vx); }
          if (x > 96) { x = 96; vx = -Math.abs(vx); }
          if (y < 8) { y = 8; vy = Math.abs(vy); }
          if (y > 90) { y = 90; vy = -Math.abs(vy); }
          const rot = Math.atan2(vy, vx) * (180 / Math.PI);
          return { ...b, x, y, vx, vy, nextTurn, phase, rot };
        })
      );
      if (statusRef.current === "playing") {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status]);

  const handleCatch = useCallback(
    (b: Butterfly, e: React.MouseEvent | React.TouchEvent) => {
      if (b.caught || statusRef.current !== "playing") return;
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const sid = Date.now() + Math.random();
      setSparkles((prev) => [
        ...prev,
        { id: sid, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      ]);
      setTimeout(() => setSparkles((prev) => prev.filter((s) => s.id !== sid)), 800);

      setButterflies((prev) => prev.map((p) => (p.id === b.id ? { ...p, caught: true } : p)));
      setTimeout(() => {
        setButterflies((prev) => prev.filter((p) => p.id !== b.id));
      }, 600);

      const inc = b.rare ? 3 : 1;
      setScore((s) => s + inc);
      setCaughtCount((c) => {
        const next = c + 1;
        if (next >= TARGET && statusRef.current === "playing") {
          setStatus("won");
          onWinRef.current();
        }
        return next;
      });
    },
    []
  );

  const progress = Math.min(100, (caughtCount / TARGET) * 100);
  const timePct = Math.max(0, (timeLeft / TIME_LIMIT) * 100);
  const lowTime = timeLeft <= 8;

  const petals = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 10,
        dur: 14 + Math.random() * 10,
        size: 14 + Math.random() * 14,
        emoji: ["🌸", "🌷", "💜", "✨"][i % 4],
      })),
    []
  );

  return (
    <main className="relative min-h-screen overflow-hidden butterfly-drift-bg select-none">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-20 size-[420px] rounded-full blur-3xl opacity-50"
             style={{ background: "radial-gradient(circle, oklch(0.88 0.16 320 / 0.7), transparent 70%)" }} />
        <div className="absolute top-1/2 -right-32 size-[480px] rounded-full blur-3xl opacity-50"
             style={{ background: "radial-gradient(circle, oklch(0.78 0.18 285 / 0.6), transparent 70%)" }} />
        <div className="absolute bottom-0 left-1/3 size-[360px] rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(circle, oklch(0.85 0.14 340 / 0.7), transparent 70%)" }} />
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {petals.map((p) => (
          <span
            key={p.id}
            className="petal-float"
            style={{
              left: `${p.left}%`,
              top: `-10%`,
              fontSize: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 26 }).map((_, i) => (
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

      <header className="relative z-20 flex items-center justify-between gap-3 p-4 sm:p-6">
        <Link
          to="/map"
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
        >
          ← Map
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full glass px-3 sm:px-4 py-2 shadow-soft">
            <span className="text-xs font-semibold text-violet-deep/70">Caught </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{caughtCount}</span>
            <span className="text-xs font-semibold text-violet-deep/70"> / {TARGET}</span>
          </div>
          <div className={`rounded-full glass px-3 sm:px-4 py-2 shadow-soft ${lowTime ? "animate-pulse-glow" : ""}`}>
            <span className="text-xs font-semibold text-violet-deep/70">⏱ </span>
            <span className={`text-sm font-bold tabular-nums ${lowTime ? "text-destructive" : "text-violet-deep"}`}>
              {timeLeft}s
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-20 mx-auto max-w-md px-6 space-y-2">
        <div className="h-2 rounded-full glass overflow-hidden">
          <div
            className="h-full bg-button-grad transition-all duration-300 shadow-glow"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="h-1.5 rounded-full glass overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${lowTime ? "bg-destructive" : "bg-button-grad"}`}
            style={{ width: `${timePct}%` }}
          />
        </div>
        <p className="text-center text-xs font-semibold text-violet-deep/70 tracking-wide">
          Level {levelId} · Butterfly Drift 🦋 · Bonus +3 for rare
        </p>
      </div>

      <div className="absolute inset-0 z-10">
        {butterflies.map((b) => (
          <button
            key={b.id}
            onClick={(e) => handleCatch(b, e)}
            onTouchStart={(e) => { e.preventDefault(); handleCatch(b, e); }}
            disabled={b.caught}
            aria-label={b.rare ? "Rare butterfly" : "Butterfly"}
            className={`butterfly ${b.caught ? "is-caught" : ""} ${b.rare ? "is-rare" : ""}`}
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.size,
              height: b.size,
              transform: `translate(-50%, -50%) rotate(${b.rot * 0.15}deg)`,
              ["--hue" as string]: `${b.hue}`,
            }}
          >
            <ButterflySVG hue={b.hue} rare={b.rare} />
          </button>
        ))}
      </div>

      <div aria-hidden className="pointer-events-none fixed inset-0 z-30">
        {sparkles.map((s) => (
          <span key={s.id} className="butterfly-sparkle" style={{ left: s.x, top: s.y }}>
            <span>✨</span><span>💜</span><span>✨</span><span>🌸</span><span>✨</span>
          </span>
        ))}
      </div>

      {status !== "playing" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-violet-deep/40 backdrop-blur-md animate-[fade-up_0.4s_ease-out]">
          <div className="relative w-full max-w-md rounded-[2rem] glass shadow-glow p-10 text-center animate-[zoom-in_0.5s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="mx-auto size-24 rounded-full bg-button-grad flex items-center justify-center text-5xl shadow-glow animate-float">
              {status === "won" ? "🦋" : "🌷"}
            </div>
            <h2 className="mt-6 text-4xl font-bold text-gradient">
              {status === "won" ? "Garden Cleared 💜" : "Try Again"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {status === "won"
                ? `You caught ${caughtCount} butterflies and scored ${score} points.`
                : `Time ran out — you caught ${caughtCount}/${TARGET}. The garden awaits another try.`}
            </p>
            <div className="mt-7 flex flex-col gap-3">
              {status === "lost" && (
                <button
                  onClick={() => {
                    setButterflies(Array.from({ length: 5 }, (_, i) => makeButterfly(i)));
                    setScore(0);
                    setCaughtCount(0);
                    setTimeLeft(TIME_LIMIT);
                    idRef.current = 100;
                    setStatus("playing");
                  }}
                  className="w-full rounded-full bg-button-grad px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  Try Again →
                </button>
              )}
              <button
                onClick={onReturn}
                className={`w-full rounded-full px-6 py-3.5 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95 ${
                  status === "won"
                    ? "bg-button-grad text-primary-foreground shadow-glow"
                    : "glass text-violet-deep shadow-soft"
                }`}
              >
                Return to Map
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ButterflySVG({ hue, rare }: { hue: number; rare: boolean }) {
  const c1 = `oklch(0.85 0.16 ${hue})`;
  const c2 = `oklch(0.7 0.2 ${hue + 20})`;
  const c3 = `oklch(0.55 0.22 ${hue - 10})`;
  return (
    <svg viewBox="0 0 100 100" className="butterfly-svg size-full" aria-hidden>
      <defs>
        <radialGradient id={`wing-${hue}-${rare ? 1 : 0}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="60%" stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
        </radialGradient>
      </defs>
      <g className="wing wing-l">
        <ellipse cx="30" cy="35" rx="22" ry="18" fill={`url(#wing-${hue}-${rare ? 1 : 0})`} opacity="0.95" />
        <ellipse cx="32" cy="62" rx="18" ry="14" fill={`url(#wing-${hue}-${rare ? 1 : 0})`} opacity="0.9" />
        <circle cx="26" cy="32" r="3" fill="oklch(1 0 0 / 0.7)" />
      </g>
      <g className="wing wing-r">
        <ellipse cx="70" cy="35" rx="22" ry="18" fill={`url(#wing-${hue}-${rare ? 1 : 0})`} opacity="0.95" />
        <ellipse cx="68" cy="62" rx="18" ry="14" fill={`url(#wing-${hue}-${rare ? 1 : 0})`} opacity="0.9" />
        <circle cx="74" cy="32" r="3" fill="oklch(1 0 0 / 0.7)" />
      </g>
      <ellipse cx="50" cy="50" rx="3.2" ry="20" fill="oklch(0.3 0.1 295)" />
      <circle cx="50" cy="30" r="3.6" fill="oklch(0.3 0.1 295)" />
    </svg>
  );
}
