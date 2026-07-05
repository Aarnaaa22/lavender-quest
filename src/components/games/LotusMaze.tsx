import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Procedurally generated maze using recursive backtracker.
// Grid is (2n+1) x (2m+1) with walls between cells.
const COLS = 25; // must be odd
const ROWS = 19; // must be odd
const TILE = 28; // logical pixels per cell for rendering scale
const SPEED = 5.2; // pixels per frame at 60fps (in TILE units => cells/sec ~ 60*SPEED/TILE)
const TOTAL_TIME = 75;
const HINTS = 3;
const VISION_RADIUS = 4.2; // cells

type Grid = number[][]; // 0 path, 1 wall
type Dir = "up" | "down" | "left" | "right" | null;

function generateMaze(cols: number, rows: number): Grid {
  const g: Grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  const inBounds = (x: number, y: number) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1;
  const stack: [number, number][] = [[1, 1]];
  g[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]].sort(() => Math.random() - 0.5);
    let carved = false;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny) && g[ny][nx] === 1) {
        g[y + dy / 2][x + dx / 2] = 0;
        g[ny][nx] = 0;
        stack.push([nx, ny]);
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }
  // Knock a few extra walls for loops / more interesting branching
  const extra = Math.floor((cols * rows) / 60);
  for (let i = 0; i < extra; i++) {
    const x = 1 + 2 * Math.floor(Math.random() * ((cols - 1) / 2));
    const y = 1 + 2 * Math.floor(Math.random() * ((rows - 1) / 2));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
    const wx = x + dx, wy = y + dy;
    if (wx > 0 && wy > 0 && wx < cols - 1 && wy < rows - 1) g[wy][wx] = 0;
  }
  return g;
}

function bfsPath(grid: Grid, sx: number, sy: number, gx: number, gy: number): [number, number][] {
  const rows = grid.length, cols = grid[0].length;
  const key = (x: number, y: number) => y * cols + x;
  const prev = new Map<number, number | null>();
  prev.set(key(sx, sy), null);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === gx && y === gy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (grid[ny][nx] === 1) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, key(x, y));
      q.push([nx, ny]);
    }
  }
  const out: [number, number][] = [];
  let cur: number | null = key(gx, gy);
  if (!prev.has(cur)) return out;
  while (cur !== null && cur !== undefined) {
    const x = cur % cols, y = Math.floor(cur / cols);
    out.push([x, y]);
    cur = prev.get(cur) ?? null;
  }
  return out.reverse();
}

export default function LotusMaze({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [seed, setSeed] = useState(0);
  const grid = useMemo(() => generateMaze(COLS, ROWS), [seed]);
  const goal = useMemo<[number, number]>(() => [COLS - 2, ROWS - 2], []);

  // Player position in pixel-space (cell units * TILE for rendering).
  // Store as continuous cell coordinates (float).
  const posRef = useRef({ x: 1, y: 1 });
  const dirRef = useRef<Dir>(null);
  const queuedRef = useRef<Dir>(null); // Pac-Man style queued turn
  const [, forceRender] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [hintsLeft, setHintsLeft] = useState(HINTS);
  const [hintPath, setHintPath] = useState<[number, number][]>([]);
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const isWall = useCallback((cx: number, cy: number) => {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    return grid[cy][cx] === 1;
  }, [grid]);

  const setDirection = useCallback((d: Dir) => {
    if (!d || doneRef.current) return;
    const { x, y } = posRef.current;
    const cx = Math.round(x), cy = Math.round(y);
    const nearCenter = Math.abs(x - cx) < 0.15 && Math.abs(y - cy) < 0.15;
    const check = (dx: number, dy: number) => !isWall(cx + dx, cy + dy);
    const canGo =
      d === "left" ? check(-1, 0) :
      d === "right" ? check(1, 0) :
      d === "up" ? check(0, -1) :
      check(0, 1);
    // Allow reversing instantly.
    const reverse =
      (dirRef.current === "left" && d === "right") ||
      (dirRef.current === "right" && d === "left") ||
      (dirRef.current === "up" && d === "down") ||
      (dirRef.current === "down" && d === "up");
    if (canGo && (nearCenter || reverse || dirRef.current === null)) {
      dirRef.current = d;
      queuedRef.current = null;
    } else {
      queuedRef.current = d;
    }
  }, [isWall]);

  // Keyboard - fires on keydown; direction persists (Pac-Man style).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== "playing") return;
      const k = e.key.toLowerCase();
      const map: Record<string, Dir> = {
        arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const d = map[k];
      if (d) {
        e.preventDefault();
        setDirection(d);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDirection, status]);

  // Game loop - continuous smooth movement.
  useEffect(() => {
    if (status !== "playing") return;
    const step = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const dt = Math.min(0.05, (ts - last) / 1000); // seconds, capped
      lastTsRef.current = ts;

      const cellsPerSec = (60 * SPEED) / TILE * 3.5; // tuned speed
      const move = cellsPerSec * dt;
      const p = posRef.current;
      let d = dirRef.current;

      // Try to apply queued turn if we're near cell center.
      const cx = Math.round(p.x), cy = Math.round(p.y);
      const nearCenter = Math.abs(p.x - cx) < 0.12 && Math.abs(p.y - cy) < 0.12;
      if (nearCenter && queuedRef.current) {
        const q = queuedRef.current;
        const check = (dx: number, dy: number) => !isWall(cx + dx, cy + dy);
        const ok =
          q === "left" ? check(-1, 0) :
          q === "right" ? check(1, 0) :
          q === "up" ? check(0, -1) :
          check(0, 1);
        if (ok) {
          // snap to axis center for the perpendicular component
          if (q === "left" || q === "right") p.y = cy;
          else p.x = cx;
          d = q;
          dirRef.current = q;
          queuedRef.current = null;
        }
      }

      if (d) {
        let nx = p.x, ny = p.y;
        if (d === "left") nx = p.x - move;
        else if (d === "right") nx = p.x + move;
        else if (d === "up") ny = p.y - move;
        else if (d === "down") ny = p.y + move;

        // Snap perpendicular axis while moving.
        if (d === "left" || d === "right") ny = Math.round(p.y);
        else nx = Math.round(p.x);

        // Wall collision: check the cell the leading edge would enter.
        const leadX = d === "right" ? Math.ceil(nx) : d === "left" ? Math.floor(nx) : Math.round(nx);
        const leadY = d === "down" ? Math.ceil(ny) : d === "up" ? Math.floor(ny) : Math.round(ny);
        if (isWall(leadX, leadY)) {
          // stop at center of current cell
          if (d === "left" || d === "right") nx = Math.round(p.x);
          else ny = Math.round(p.y);
          dirRef.current = null;
        }
        p.x = nx;
        p.y = ny;
      }

      // Goal check
      const gx = goal[0], gy = goal[1];
      if (Math.hypot(p.x - gx, p.y - gy) < 0.45) {
        doneRef.current = true;
        setStatus("won");
        onWin();
      }

      forceRender((n) => (n + 1) % 1000000);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [status, isWall, goal, onWin]);

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

  const useHint = () => {
    if (hintsLeft <= 0 || status !== "playing") return;
    const p = posRef.current;
    const path = bfsPath(grid, Math.round(p.x), Math.round(p.y), goal[0], goal[1]);
    setHintsLeft((h) => h - 1);
    setHintPath(path);
    setTimeout(() => setHintPath([]), 2600);
  };

  const reset = () => {
    posRef.current = { x: 1, y: 1 };
    dirRef.current = null;
    queuedRef.current = null;
    setTimeLeft(TOTAL_TIME);
    setHintsLeft(HINTS);
    setHintPath([]);
    setStatus("playing");
    doneRef.current = false;
    setSeed((s) => s + 1);
  };

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? "right" : "left");
    else setDirection(dy > 0 ? "down" : "up");
    touchRef.current = null;
  };

  const timeLow = timeLeft <= 10;
  const hintSet = new Set(hintPath.map(([x, y]) => `${x},${y}`));
  const p = posRef.current;
  const distToGoal = Math.hypot(p.x - goal[0], p.y - goal[1]);
  const goalGlow = Math.max(0, 1 - distToGoal / (VISION_RADIUS + 2));

  const viewW = COLS * TILE;
  const viewH = ROWS * TILE;

  return (
    <main
      className="relative min-h-screen overflow-hidden lotus-maze-bg"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/70 animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: 2 + Math.random() * 3,
              height: 2 + Math.random() * 3,
              animationDelay: `${Math.random() * 4}s`,
              boxShadow: "0 0 8px rgba(255,255,255,0.85)",
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
          <button
            onClick={useHint}
            disabled={hintsLeft === 0 || status !== "playing"}
            className="rounded-full glass px-3 sm:px-4 py-2 shadow-soft text-xs font-bold text-violet-deep hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100"
          >
            ✨ Hint <span className="tabular-nums">{hintsLeft}</span>
          </button>
          <div className={`rounded-full glass px-3 sm:px-4 py-2 shadow-soft ${timeLow ? "ring-2 ring-rose-400/70 animate-pulse" : ""}`}>
            <span className="text-xs font-semibold text-violet-deep/70">⏱ </span>
            <span className={`text-sm font-bold tabular-nums ${timeLow ? "text-rose-500" : "text-violet-deep"}`}>{timeLeft}s</span>
          </div>
        </div>
      </header>

      <p className="relative z-20 text-center text-xs font-semibold text-violet-deep/70 tracking-wide">
        Level {levelId} · Lotus Maze 🌸 — glide the orb to the lotus
      </p>

      <div className="relative z-10 mx-auto mt-4 px-3 flex items-center justify-center">
        <div
          className="relative rounded-2xl lm-frame p-2 sm:p-3"
          style={{ width: "min(96vw, 780px)" }}
        >
          <div
            className="relative w-full rounded-xl overflow-hidden lm-board"
            style={{ aspectRatio: `${COLS} / ${ROWS}` }}
          >
            <svg
              viewBox={`0 0 ${viewW} ${viewH}`}
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <radialGradient id="lm-vision" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#000" stopOpacity="0" />
                  <stop offset="55%" stopColor="#000" stopOpacity="0" />
                  <stop offset="100%" stopColor="#0b0620" stopOpacity="0.96" />
                </radialGradient>
                <filter id="lm-glow">
                  <feGaussianBlur stdDeviation="2.4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Walls */}
              {grid.map((row, y) =>
                row.map((cell, x) =>
                  cell === 1 ? (
                    <rect
                      key={`w-${x}-${y}`}
                      x={x * TILE}
                      y={y * TILE}
                      width={TILE}
                      height={TILE}
                      className="lm-wall-rect"
                    />
                  ) : null,
                ),
              )}

              {/* Hint path dots */}
              {hintPath.map(([x, y]) =>
                hintSet.has(`${x},${y}`) ? (
                  <circle
                    key={`h-${x}-${y}`}
                    cx={x * TILE + TILE / 2}
                    cy={y * TILE + TILE / 2}
                    r={TILE * 0.14}
                    className="lm-hint-dot"
                  />
                ) : null,
              )}

              {/* Goal (lotus) */}
              <g transform={`translate(${goal[0] * TILE + TILE / 2}, ${goal[1] * TILE + TILE / 2})`}>
                <circle r={TILE * 0.55} className="lm-goal-halo" style={{ opacity: 0.35 + goalGlow * 0.6 }} />
                <circle r={TILE * 0.32} className="lm-goal-core" />
                <text textAnchor="middle" dominantBaseline="central" fontSize={TILE * 0.7} style={{ pointerEvents: "none" }}>🌸</text>
              </g>

              {/* Player */}
              <g
                transform={`translate(${p.x * TILE + TILE / 2}, ${p.y * TILE + TILE / 2})`}
                filter="url(#lm-glow)"
              >
                <circle r={TILE * 0.55} className="lm-player-halo" />
                <circle r={TILE * 0.28} className="lm-player-core" />
              </g>

              {/* Vision mask - dark overlay outside radius */}
              <circle
                cx={p.x * TILE + TILE / 2}
                cy={p.y * TILE + TILE / 2}
                r={VISION_RADIUS * TILE * 1.6}
                fill="url(#lm-vision)"
                style={{ pointerEvents: "none" }}
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="relative z-20 mt-4 sm:hidden flex justify-center">
        <div className="grid grid-cols-3 gap-2">
          <div />
          <button onClick={() => setDirection("up")} className="rounded-xl glass w-12 h-12 text-lg font-bold text-violet-deep shadow-soft active:scale-90">↑</button>
          <div />
          <button onClick={() => setDirection("left")} className="rounded-xl glass w-12 h-12 text-lg font-bold text-violet-deep shadow-soft active:scale-90">←</button>
          <button onClick={() => setDirection("down")} className="rounded-xl glass w-12 h-12 text-lg font-bold text-violet-deep shadow-soft active:scale-90">↓</button>
          <button onClick={() => setDirection("right")} className="rounded-xl glass w-12 h-12 text-lg font-bold text-violet-deep shadow-soft active:scale-90">→</button>
        </div>
      </div>

      {status !== "playing" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-violet-deep/40 backdrop-blur-md animate-[fade-up_0.4s_ease-out]">
          <div className="relative w-full max-w-md rounded-[2rem] glass shadow-glow p-8 sm:p-10 text-center animate-[zoom-in_0.5s_cubic-bezier(0.16,1,0.3,1)]">
            <div className={`mx-auto size-24 rounded-full flex items-center justify-center text-5xl shadow-glow animate-float ${status === "won" ? "bg-button-grad" : "bg-gradient-to-br from-rose-400 to-pink-500"}`}>
              {status === "won" ? "🌸" : "🌫️"}
            </div>
            <h2 className="mt-6 text-3xl sm:text-4xl font-bold text-gradient">
              {status === "won" ? "Lotus Found 💜" : "Lost in the Maze"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {status === "won"
                ? "You guided the orb to the glowing lotus."
                : "The mist closed in before you reached the lotus."}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <button
                onClick={reset}
                className="flex-1 rounded-full glass px-6 py-3 text-sm font-bold text-violet-deep hover:scale-[1.02] active:scale-95 transition-transform shadow-soft"
              >↺ Try Again</button>
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
