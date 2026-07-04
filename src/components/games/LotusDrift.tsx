import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = { levelId: number; onWin: () => void; onReturn: () => void };

const SURVIVE_MS = 20000;
const SAFE_HALF = 34; // wide safe zone
const BOUND_HALF = 46; // very forgiving hard boundary
const DRAIN_PER_SEC = 6; // gentle drain outside safe zone
const REFILL_PER_SEC = 22; // fast refill inside

export default function LotusDrift({ levelId, onWin, onReturn }: Props) {
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [balance, setBalance] = useState(100);
  const [timeLeft, setTimeLeft] = useState(Math.ceil(SURVIVE_MS / 1000));
  const [lotusX, setLotusX] = useState(50); // % from left center
  const [waveOffset, setWaveOffset] = useState(0); // px tilt visual

  const lotusXRef = useRef(50);
  const balanceRef = useRef(100);
  const inputRef = useRef(0); // -1, 0, 1
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const doneRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<number | null>(null);

  const finish = useCallback(
    (result: "won" | "lost") => {
      if (doneRef.current) return;
      doneRef.current = true;
      setStatus(result);
      if (result === "won") onWin();
    },
    [onWin],
  );

  // Keyboard controls
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") inputRef.current = -1;
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") inputRef.current = 1;
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(e.key)) inputRef.current = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Pointer (mouse/touch) - drag steering
  const onPointer = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    pointerRef.current = Math.max(0, Math.min(100, pct));
  };

  // Game loop
  useEffect(() => {
    if (status !== "playing") return;
    startRef.current = performance.now();
    let last = startRef.current;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const elapsed = now - startRef.current;

      // Wave force: smooth sine + occasional gust
      const t = elapsed / 1000;
      const intensity = 1 + Math.min(1.2, elapsed / 16000); // grows over time
      const wave =
        Math.sin(t * 1.1) * 8 * intensity +
        Math.sin(t * 0.37 + 1.2) * 5 * intensity +
        Math.sin(t * 2.3) * 2.5 * intensity;
      // Occasional gust
      const gust = Math.sin(t * 0.21) > 0.92 ? Math.sin(t * 6) * 10 : 0;
      const waveForce = (wave + gust) * dt; // % per frame contribution

      // Player input
      let target = lotusXRef.current;
      if (pointerRef.current !== null) {
        // ease toward pointer
        target += (pointerRef.current - target) * Math.min(1, dt * 7);
      }
      target += inputRef.current * 55 * dt;
      target += waveForce;

      // Clamp to outer bounds visually but lose if past boundary
      const center = 50;
      const offsetFromCenter = target - center;

      if (Math.abs(offsetFromCenter) > BOUND_HALF) {
        lotusXRef.current = center + Math.sign(offsetFromCenter) * BOUND_HALF;
        setLotusX(lotusXRef.current);
        finish("lost");
        return;
      }

      lotusXRef.current = target;
      setLotusX(target);
      setWaveOffset(wave + gust);

      // Balance meter
      const outside = Math.abs(offsetFromCenter) > SAFE_HALF;
      const next = balanceRef.current + (outside ? -DRAIN_PER_SEC : REFILL_PER_SEC) * dt;
      balanceRef.current = Math.max(0, Math.min(100, next));
      setBalance(balanceRef.current);

      if (balanceRef.current <= 0) {
        finish("lost");
        return;
      }

      setTimeLeft(Math.max(0, Math.ceil((SURVIVE_MS - elapsed) / 1000)));

      if (elapsed >= SURVIVE_MS) {
        finish("won");
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, finish]);

  const reset = () => {
    doneRef.current = false;
    lotusXRef.current = 50;
    balanceRef.current = 100;
    inputRef.current = 0;
    pointerRef.current = null;
    setLotusX(50);
    setBalance(100);
    setTimeLeft(Math.ceil(SURVIVE_MS / 1000));
    setStatus("playing");
  };

  const tilt = Math.max(-18, Math.min(18, (lotusX - 50) * 0.5 + waveOffset * 0.6));
  const balanceLow = balance < 35;

  return (
    <main className="relative min-h-screen overflow-hidden lotus-drift-bg select-none">
      {/* Stars / sparkles */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/80 animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 55}%`,
              width: 2 + Math.random() * 3,
              height: 2 + Math.random() * 3,
              animationDelay: `${Math.random() * 4}s`,
              boxShadow: "0 0 10px rgba(255,255,255,0.9)",
            }}
          />
        ))}
      </div>

      {/* Sun / horizon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{
          top: "28%",
          width: 240,
          height: 240,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, oklch(0.88 0.12 25 / 0.85), oklch(0.78 0.15 320 / 0.4) 60%, transparent 70%)",
          filter: "blur(6px)",
        }}
      />

      {/* Header */}
      <header className="relative z-30 flex items-center justify-between gap-3 p-4 sm:p-6">
        <Link
          to="/map"
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
        >
          ← Map
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full glass px-3 sm:px-4 py-2 shadow-soft min-w-[140px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-violet-deep/70">⚖️ Balance</span>
              <span className="text-[10px] font-bold tabular-nums text-violet-deep/80">
                {Math.round(balance)}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-violet-deep/15 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  balanceLow ? "bg-gradient-to-r from-rose-400 to-pink-500" : "bg-button-grad"
                }`}
                style={{ width: `${balance}%` }}
              />
            </div>
          </div>
          <div
            className={`rounded-full glass px-3 sm:px-4 py-2 shadow-soft ${
              timeLeft <= 5 ? "ring-2 ring-rose-400/70 animate-pulse" : ""
            }`}
          >
            <span className="text-xs font-semibold text-violet-deep/70">⏱ </span>
            <span className="text-sm font-bold tabular-nums text-violet-deep">{timeLeft}s</span>
          </div>
        </div>
      </header>

      <div className="relative z-30 mx-auto max-w-md px-6">
        <p className="text-center text-xs font-semibold text-violet-deep/70 tracking-wide">
          Level {levelId} · Lotus Drift 🌸 — keep it inside the glowing zone
        </p>
      </div>

      {/* Play area */}
      <div
        ref={containerRef}
        className="absolute inset-x-0 bottom-0 z-20 h-[62vh] touch-none"
        onMouseDown={(e) => onPointer(e.clientX)}
        onMouseMove={(e) => {
          if (e.buttons === 1) onPointer(e.clientX);
        }}
        onMouseUp={() => (pointerRef.current = null)}
        onMouseLeave={() => (pointerRef.current = null)}
        onTouchStart={(e) => onPointer(e.touches[0].clientX)}
        onTouchMove={(e) => onPointer(e.touches[0].clientX)}
        onTouchEnd={() => (pointerRef.current = null)}
      >
        {/* Water layers */}
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <svg
            viewBox="0 0 1440 400"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            <defs>
              <linearGradient id="ld-water" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.78 0.13 295)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="oklch(0.45 0.18 295)" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <path
              className="ld-wave-a"
              d="M0,140 C240,80 480,200 720,140 C960,80 1200,200 1440,140 L1440,400 L0,400 Z"
              fill="url(#ld-water)"
              opacity="0.7"
            />
            <path
              className="ld-wave-b"
              d="M0,180 C240,240 480,120 720,180 C960,240 1200,120 1440,180 L1440,400 L0,400 Z"
              fill="oklch(0.55 0.18 305 / 0.55)"
            />
            <path
              className="ld-wave-c"
              d="M0,220 C240,180 480,280 720,220 C960,160 1200,280 1440,220 L1440,400 L0,400 Z"
              fill="oklch(0.38 0.16 295 / 0.7)"
            />
          </svg>
        </div>

        {/* Safe zone visual */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[20%] left-1/2 -translate-x-1/2 h-[60%] rounded-[40%] border-2 border-dashed border-blossom/60"
          style={{
            width: `${SAFE_HALF * 2}%`,
            boxShadow: "0 0 40px oklch(0.85 0.12 320 / 0.45), inset 0 0 30px oklch(0.85 0.12 320 / 0.25)",
          }}
        />

        {/* Lotus */}
        <div
          className="absolute"
          style={{
            left: `${lotusX}%`,
            top: "40%",
            transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
            transition: "transform 0.08s linear",
          }}
        >
          <div className="lotus-bob">
            <div
              style={{
                fontSize: 64,
                filter: `drop-shadow(0 8px 20px oklch(0.78 0.18 320 / 0.7)) drop-shadow(0 0 18px oklch(0.92 0.1 320 / 0.8))`,
              }}
            >
              🌸
            </div>
            {/* Reflection */}
            <div
              aria-hidden
              style={{
                fontSize: 64,
                opacity: 0.25,
                transform: "scaleY(-1)",
                filter: "blur(2px)",
                marginTop: -10,
              }}
            >
              🌸
            </div>
          </div>
        </div>

        {/* Hint */}
        {status === "playing" && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-[11px] font-semibold text-white/80 tracking-wide">
            ← → / drag to steer
          </div>
        )}
      </div>

      {/* End screen */}
      {status !== "playing" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-violet-deep/40 backdrop-blur-md animate-[fade-up_0.4s_ease-out]">
          <div className="relative w-full max-w-md rounded-[2rem] glass shadow-glow p-8 sm:p-10 text-center animate-[zoom-in_0.5s_cubic-bezier(0.16,1,0.3,1)]">
            <div
              className={`mx-auto size-24 rounded-full flex items-center justify-center text-5xl shadow-glow animate-float ${
                status === "won" ? "bg-button-grad" : "bg-gradient-to-br from-rose-400 to-pink-500"
              }`}
            >
              {status === "won" ? "🌸" : "🌊"}
            </div>
            <h2 className="mt-6 text-3xl sm:text-4xl font-bold text-gradient">
              {status === "won" ? "Waters Calmed 💜" : "Try Again"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {status === "won"
                ? "You held the lotus steady through every wave."
                : balance <= 0
                  ? "Your balance ran out — stay near the glowing zone."
                  : "The lotus drifted too far. Steady, gentle adjustments win."}
            </p>
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
