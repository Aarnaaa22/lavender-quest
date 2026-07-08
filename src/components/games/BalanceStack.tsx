import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

type Block = {
  x: number;
  y: number;
  width: number;
  color: string;
  emoji: string;
};

type FallingPiece = {
  id: number;
  x: number;
  y: number;
  width: number;
  color: string;
  vy: number;
  vx: number;
};

const CANVAS_W = 420;
const CANVAS_H = 620;
const BLOCK_H = 34;
const BASE_WIDTH = 200;
const START_SPEED = 2.4;
const SPEED_STEP = 0.11;
const MAX_SPEED = 6.5;
const TOLERANCE = 6;

const DESSERTS = [
  { emoji: "🧁", color: "linear-gradient(180deg,#f9c9e6,#d69fe6)" },
  { emoji: "🍰", color: "linear-gradient(180deg,#f6d1e8,#c9a3e8)" },
  { emoji: "🍦", color: "linear-gradient(180deg,#efe0ff,#c8b0f0)" },
  { emoji: "🍡", color: "linear-gradient(180deg,#ffd6ee,#e0b6ff)" },
  { emoji: "🍬", color: "linear-gradient(180deg,#f0d4ff,#b697f0)" },
  { emoji: "🎂", color: "linear-gradient(180deg,#ffe0f2,#d9b6ff)" },
];

const BEST_KEY = "balance-stack-best";

export default function BalanceStack({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [stack, setStack] = useState<Block[]>(() => [
    {
      x: (CANVAS_W - BASE_WIDTH) / 2,
      y: CANVAS_H - BLOCK_H,
      width: BASE_WIDTH,
      color: "linear-gradient(180deg,#c8a6ff,#8f6bd6)",
      emoji: "🌸",
    },
  ]);
  const [current, setCurrent] = useState<Block | null>(null);
  const [pieces, setPieces] = useState<FallingPiece[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem(BEST_KEY) ?? 0);
  });
  const [status, setStatus] = useState<"playing" | "over">("playing");
  const [cameraY, setCameraY] = useState(0);

  const dirRef = useRef(1);
  const speedRef = useRef(START_SPEED);
  const rafRef = useRef<number | null>(null);
  const currentRef = useRef<Block | null>(null);
  const stackRef = useRef<Block[]>(stack);
  const wonRef = useRef(false);
  const pieceIdRef = useRef(0);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  const spawnBlock = useCallback(() => {
    const top = stackRef.current[stackRef.current.length - 1];
    const dessert = DESSERTS[Math.floor(Math.random() * DESSERTS.length)];
    const block: Block = {
      x: 0,
      y: top.y - BLOCK_H,
      width: top.width,
      color: dessert.color,
      emoji: dessert.emoji,
    };
    dirRef.current = Math.random() > 0.5 ? 1 : -1;
    setCurrent(block);
  }, []);

  // start first block
  useEffect(() => {
    spawnBlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // animation loop for moving block
  useEffect(() => {
    if (status !== "playing") return;
    const tick = () => {
      const c = currentRef.current;
      if (c) {
        // eased horizontal motion — slows near walls for a smoother pendulum feel
        const travel = CANVAS_W - c.width;
        const t = travel > 0 ? c.x / travel : 0.5; // 0..1
        const ease = 0.35 + Math.sin(Math.PI * t) * 0.65; // slow at edges, fast in middle
        let nx = c.x + speedRef.current * ease * dirRef.current;
        if (nx <= 0) {
          nx = 0;
          dirRef.current = 1;
        } else if (nx + c.width >= CANVAS_W) {
          nx = CANVAS_W - c.width;
          dirRef.current = -1;
        }
        const updated = { ...c, x: nx };
        currentRef.current = updated;
        setCurrent(updated);
      }
      // gravity on falling pieces
      setPieces((prev) =>
        prev
          .map((p) => ({ ...p, y: p.y + p.vy, x: p.x + p.vx, vy: p.vy + 0.6 }))
          .filter((p) => p.y < CANVAS_H + 200),
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status]);

  const drop = useCallback(() => {
    if (status !== "playing") return;
    const c = currentRef.current;
    if (!c) return;
    const top = stackRef.current[stackRef.current.length - 1];

    const leftOverlap = Math.max(c.x, top.x);
    const rightOverlap = Math.min(c.x + c.width, top.x + top.width);
    const overlap = rightOverlap - leftOverlap;

    if (overlap <= 0) {
      // miss - game over, drop falling piece
      const fp: FallingPiece = {
        id: pieceIdRef.current++,
        x: c.x,
        y: c.y,
        width: c.width,
        color: c.color,
        vy: 2,
        vx: c.x < top.x ? -1.5 : 1.5,
      };
      setPieces((p) => [...p, fp]);
      setCurrent(null);
      setStatus("over");
      setBest((b) => {
        const nb = Math.max(b, score);
        if (typeof window !== "undefined") window.localStorage.setItem(BEST_KEY, String(nb));
        return nb;
      });
      if (score >= 15 && !wonRef.current) {
        wonRef.current = true;
        onWin();
      }
      return;
    }

    // determine cut
    let newX = leftOverlap;
    let newWidth = overlap;
    // forgiveness: near-perfect alignment counts as perfect
    if (Math.abs(c.x - top.x) <= TOLERANCE && Math.abs(c.width - top.width) <= TOLERANCE) {
      newX = top.x;
      newWidth = top.width;
    } else {
      // spawn falling piece for the cut side
      if (c.x < top.x) {
        const cutW = top.x - c.x;
        setPieces((prev) => [
          ...prev,
          {
            id: pieceIdRef.current++,
            x: c.x,
            y: c.y,
            width: cutW,
            color: c.color,
            vy: 1.5,
            vx: -2,
          },
        ]);
      }
      if (c.x + c.width > top.x + top.width) {
        const cutW = c.x + c.width - (top.x + top.width);
        setPieces((prev) => [
          ...prev,
          {
            id: pieceIdRef.current++,
            x: top.x + top.width,
            y: c.y,
            width: cutW,
            color: c.color,
            vy: 1.5,
            vx: 2,
          },
        ]);
      }
    }

    const placed: Block = { ...c, x: newX, width: newWidth };
    setStack((s) => [...s, placed]);
    setScore((s) => {
      const ns = s + 1;
      if (ns >= 15 && !wonRef.current) {
        wonRef.current = true;
        onWin();
      }
      return ns;
    });
    speedRef.current = Math.min(MAX_SPEED, speedRef.current + SPEED_STEP);
    // camera up when stack grows tall
    setCameraY((cy) => {
      const topY = placed.y - BLOCK_H;
      if (topY - cy < 140) return cy - BLOCK_H;
      return cy;
    });
    setCurrent(null);
    setTimeout(() => {
      // spawn next above placed
      const dessert = DESSERTS[Math.floor(Math.random() * DESSERTS.length)];
      const next: Block = {
        x: 0,
        y: placed.y - BLOCK_H,
        width: newWidth,
        color: dessert.color,
        emoji: dessert.emoji,
      };
      dirRef.current = Math.random() > 0.5 ? 1 : -1;
      setCurrent(next);
    }, 90);
  }, [onWin, score, status]);

  // controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowDown") {
        e.preventDefault();
        drop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drop]);

  const restart = () => {
    wonRef.current = false;
    speedRef.current = START_SPEED;
    setStack([
      {
        x: (CANVAS_W - BASE_WIDTH) / 2,
        y: CANVAS_H - BLOCK_H,
        width: BASE_WIDTH,
        color: "linear-gradient(180deg,#c8a6ff,#8f6bd6)",
        emoji: "🌸",
      },
    ]);
    setScore(0);
    setPieces([]);
    setCameraY(0);
    setStatus("playing");
    setTimeout(spawnBlock, 60);
  };

  return (
    <main className="relative min-h-screen overflow-hidden select-none" style={{
      background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.25), transparent 55%), linear-gradient(180deg,#f5e6ff 0%,#e5d0ff 55%,#d4bcff 100%)",
    }}>
      <header className="relative z-20 mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          to="/map"
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep shadow-soft"
        >
          ← Map
        </Link>
        <div className="flex items-center gap-2">
          <div className="rounded-full glass px-4 py-2 shadow-soft">
            <span className="text-xs font-semibold text-violet-deep/70">Score </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{score}</span>
          </div>
          <div className="rounded-full glass px-4 py-2 shadow-soft">
            <span className="text-xs font-semibold text-violet-deep/70">Best </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{Math.max(best, score)}</span>
          </div>
        </div>
      </header>

      <p className="relative z-20 text-center text-xs font-semibold uppercase tracking-[0.3em] text-violet-500/80">
        Level {levelId} · Tap / Space to drop
      </p>

      <div className="relative z-10 mx-auto mt-4 flex justify-center px-3">
        <div
          role="button"
          tabIndex={0}
          onClick={drop}
          onTouchStart={(e) => { e.preventDefault(); drop(); }}
          className="relative overflow-hidden rounded-[2rem] shadow-glow"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            background: "linear-gradient(180deg,#f8ecff 0%,#e2ceff 100%)",
            border: "1px solid rgba(255,255,255,0.5)",
            cursor: "pointer",
            touchAction: "none",
          }}
        >
          {/* soft grid glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 40%), radial-gradient(circle at 80% 80%, rgba(200,150,255,0.25), transparent 45%)",
          }} />

          <div className="absolute inset-0" style={{ transform: `translateY(${-cameraY}px)`, transition: "transform 260ms cubic-bezier(0.16,1,0.3,1)" }}>
            {stack.map((b, i) => (
              <div
                key={i}
                className="absolute flex items-center justify-center rounded-xl"
                style={{
                  left: b.x,
                  top: b.y,
                  width: b.width,
                  height: BLOCK_H,
                  background: b.color,
                  boxShadow: "0 6px 18px rgba(120,70,180,0.25), inset 0 1px 0 rgba(255,255,255,0.6)",
                  transformOrigin: "50% 100%",
                  animation: i === stack.length - 1 ? "bs-land 460ms cubic-bezier(0.34,1.56,0.64,1)" : undefined,
                }}
              >
                <span className="text-lg opacity-80" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.15))" }}>{b.emoji}</span>
              </div>
            ))}

            {current && (() => {
              const top = stack[stack.length - 1];
              const leftO = Math.max(current.x, top.x);
              const rightO = Math.min(current.x + current.width, top.x + top.width);
              const overlap = Math.max(0, rightO - leftO);
              const aligned = overlap / current.width; // 0..1
              const shadowW = Math.max(24, current.width * (0.55 + aligned * 0.35));
              const shadowX = current.x + current.width / 2 - shadowW / 2;
              const shadowOpacity = 0.15 + aligned * 0.25;
              return (
                <>
                  {/* alignment shadow cast on top block */}
                  <div
                    aria-hidden
                    className="absolute rounded-[50%] pointer-events-none"
                    style={{
                      left: shadowX,
                      top: top.y + 4,
                      width: shadowW,
                      height: 10,
                      background: `radial-gradient(ellipse at center, rgba(60,20,100,${shadowOpacity}) 0%, rgba(60,20,100,0) 70%)`,
                      filter: "blur(2px)",
                      transition: "opacity 120ms linear",
                    }}
                  />
                  <div
                    className="absolute flex items-center justify-center rounded-xl"
                    style={{
                      left: current.x,
                      top: current.y,
                      width: current.width,
                      height: BLOCK_H,
                      background: current.color,
                      boxShadow: "0 8px 22px rgba(180,120,240,0.45), inset 0 1px 0 rgba(255,255,255,0.7)",
                      animation: "bs-hover 2.4s ease-in-out infinite",
                    }}
                  >
                    <span className="text-lg opacity-80">{current.emoji}</span>
                  </div>
                </>
              );
            })()}

            {pieces.map((p) => (
              <div
                key={p.id}
                className="absolute rounded-xl"
                style={{
                  left: p.x,
                  top: p.y,
                  width: p.width,
                  height: BLOCK_H,
                  background: p.color,
                  opacity: 0.85,
                  boxShadow: "0 6px 16px rgba(120,70,180,0.25)",
                }}
              />
            ))}
          </div>

          <style>{`
            @keyframes bs-land {
              0% { transform: scaleY(0.55) scaleX(1.08) translateY(-6px); }
              45% { transform: scaleY(1.12) scaleX(0.94); }
              70% { transform: scaleY(0.96) scaleX(1.02); }
              100% { transform: scaleY(1) scaleX(1); }
            }
            @keyframes bs-hover {
              0%,100% { transform: translateY(0); }
              50% { transform: translateY(-2px); }
            }
          `}</style>
        </div>
      </div>

      {status === "over" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-violet-deep/40 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[2rem] bg-white/95 p-8 text-center shadow-glow">
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 to-violet-500 text-4xl shadow-glow">💜</div>
            <h2 className="text-3xl font-bold text-gradient">Sweet Stack 💜</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              You stacked <span className="font-bold text-violet-deep">{score}</span> desserts high.
              Best: <span className="font-bold text-violet-deep">{Math.max(best, score)}</span>
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={restart}
                className="rounded-full bg-button-grad px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onReturn}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-violet-deep shadow-soft"
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
