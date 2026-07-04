import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// 0 = path, 1 = wall
type Grid = number[][];

// Maze layouts (15 cols x 13 rows). S = start (top-left area), E = lotus goal.
// Kept hand-crafted so they always solve. Player at [1,1], goal at [13,11].
const RAW_MAZES: string[][] = [
  [
    "###############",
    "#S    #     # #",
    "# ### # ### # #",
    "# #   #   # # #",
    "# # ##### # # #",
    "# #     # # # #",
    "# ##### # # # #",
    "#     # # #   #",
    "##### # # ### #",
    "#   # #   # # #",
    "# # ##### # # #",
    "# #        E# #",
    "###############",
  ],
  [
    "###############",
    "#S# #       # #",
    "# # # ##### # #",
    "#   #     #   #",
    "# ##### # ### #",
    "#     # #   # #",
    "##### # ### # #",
    "#   # #   #   #",
    "# # # ### ### #",
    "# # #   #     #",
    "# # ### ##### #",
    "#         #E  #",
    "###############",
  ],
  [
    "###############",
    "#S  #     #   #",
    "### # ### # # #",
    "#   # #   # # #",
    "# ### # ### # #",
    "#   # #   # # #",
    "### # ### # # #",
    "#   #   # #   #",
    "# ##### # ### #",
    "# #   # #   # #",
    "# # # # ### # #",
    "#   #      E# #",
    "###############",
  ],
  [
    "###############",
    "#S      #     #",
    "##### # # ### #",
    "#   # #   # # #",
    "# # ##### # # #",
    "# #     # #   #",
    "# ##### # ### #",
    "#     #     # #",
    "# ### ##### # #",
    "# # #     # # #",
    "# # ##### # # #",
    "#   #      E  #",
    "###############",
  ],
  [
    "###############",
    "#S# #   #     #",
    "# # # # # ### #",
    "#   # # #   # #",
    "### # # ### # #",
    "#   #   #   # #",
    "# ####### # # #",
    "#       # #   #",
    "####### # ### #",
    "#     # #   # #",
    "# ### # ### # #",
    "# #       # E #",
    "###############",
  ],
  [
    "###############",
    "#S    # #     #",
    "# ### # # ### #",
    "# # #   #   # #",
    "# # ##### ### #",
    "#   #   #     #",
    "### # # #######",
    "#   # #       #",
    "# ### ####### #",
    "# #   #     # #",
    "# # ### ### # #",
    "#     #    E  #",
    "###############",
  ],
];

const COLS = 15;
const ROWS = 13;
const START: [number, number] = [1, 1];
const GOAL: [number, number] = [13, 11];
const TOTAL_TIME = 55;
const HINTS = 3;
const VISION_RADIUS = 3.2; // in cells

function parseMaze(rows: string[]): Grid {
  return rows.map((r) =>
    r.split("").map((c) => (c === "#" ? 1 : 0)),
  );
}

function bfsPath(grid: Grid, start: [number, number], goal: [number, number]): [number, number][] {
  const key = (x: number, y: number) => `${x},${y}`;
  const prev = new Map<string, string | null>();
  prev.set(key(...start), null);
  const q: [number, number][] = [start];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === goal[0] && y === goal[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (grid[ny][nx] === 1) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, key(x, y));
      q.push([nx, ny]);
    }
  }
  const path: [number, number][] = [];
  let cur: string | null = key(...goal);
  while (cur) {
    const [x, y] = cur.split(",").map(Number);
    path.push([x, y]);
    cur = prev.get(cur) ?? null;
  }
  return path.reverse();
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
  const [mazeIndex, setMazeIndex] = useState(() => Math.floor(Math.random() * RAW_MAZES.length));
  const grid = useMemo(() => parseMaze(RAW_MAZES[mazeIndex]), [mazeIndex]);
  const [pos, setPos] = useState<[number, number]>(START);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [hintsLeft, setHintsLeft] = useState(HINTS);
  const [hintPath, setHintPath] = useState<[number, number][]>([]);
  const doneRef = useRef(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const move = useCallback((dx: number, dy: number) => {
    if (doneRef.current) return;
    setPos(([x, y]) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return [x, y];
      if (grid[ny][nx] === 1) return [x, y];
      if (nx === GOAL[0] && ny === GOAL[1]) {
        doneRef.current = true;
        setStatus("won");
        onWin();
      }
      return [nx, ny];
    });
  }, [grid, onWin]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== "playing") return;
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
        W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
      };
      const m = map[e.key];
      if (m) {
        e.preventDefault();
        move(m[0], m[1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, status]);

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
    const path = bfsPath(grid, pos, GOAL);
    setHintsLeft((h) => h - 1);
    setHintPath(path);
    setTimeout(() => setHintPath([]), 2600);
  };

  const reset = () => {
    setMazeIndex(Math.floor(Math.random() * RAW_MAZES.length));
    setPos(START);
    setTimeLeft(TOTAL_TIME);
    setHintsLeft(HINTS);
    setHintPath([]);
    setStatus("playing");
    doneRef.current = false;
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
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (Math.max(absX, absY) < 20) return;
    if (absX > absY) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy > 0 ? 1 : -1);
    touchRef.current = null;
  };

  const timeLow = timeLeft <= 10;
  const hintSet = new Set(hintPath.map(([x, y]) => `${x},${y}`));

  return (
    <main
      className="relative min-h-screen overflow-hidden lotus-maze-bg"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Ambient sparkles */}
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
              boxShadow: "0 0 8px rgba(255,255,255,0.9)",
            }}
          />
        ))}
      </div>

      {/* Header */}
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
        Level {levelId} · Lotus Maze 🌸 — reach the glowing lotus
      </p>

      {/* Maze */}
      <div className="relative z-10 mx-auto mt-4 px-4 flex items-center justify-center">
        <div
          className="relative rounded-2xl glass shadow-glow p-3 sm:p-4"
          style={{ width: "min(92vw, 640px)" }}
        >
          <div
            className="relative w-full lotus-maze-grid"
            style={{
              aspectRatio: `${COLS} / ${ROWS}`,
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
              gap: 2,
            }}
          >
            {grid.map((row, y) =>
              row.map((cell, x) => {
                const dist = Math.hypot(x - pos[0], y - pos[1]);
                const brightness = Math.max(0.08, 1 - dist / VISION_RADIUS);
                const isGoal = x === GOAL[0] && y === GOAL[1];
                const isHint = hintSet.has(`${x},${y}`);
                return (
                  <div
                    key={`${x}-${y}`}
                    className={
                      cell === 1
                        ? "lm-wall"
                        : isGoal
                          ? "lm-goal"
                          : isHint
                            ? "lm-path lm-hint"
                            : "lm-path"
                    }
                    style={{ opacity: brightness }}
                  >
                    {isGoal && brightness > 0.15 && <span className="lm-lotus">🌸</span>}
                  </div>
                );
              }),
            )}
            {/* Player */}
            <div
              className="lm-player"
              style={{
                gridColumnStart: pos[0] + 1,
                gridRowStart: pos[1] + 1,
              }}
            >
              <span>💜</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile D-pad */}
      <div className="relative z-20 mt-4 sm:hidden flex justify-center">
        <div className="grid grid-cols-3 gap-2">
          <div />
          <button onClick={() => move(0, -1)} className="rounded-xl glass w-12 h-12 text-lg font-bold text-violet-deep shadow-soft active:scale-90">↑</button>
          <div />
          <button onClick={() => move(-1, 0)} className="rounded-xl glass w-12 h-12 text-lg font-bold text-violet-deep shadow-soft active:scale-90">←</button>
          <button onClick={() => move(0, 1)} className="rounded-xl glass w-12 h-12 text-lg font-bold text-violet-deep shadow-soft active:scale-90">↓</button>
          <button onClick={() => move(1, 0)} className="rounded-xl glass w-12 h-12 text-lg font-bold text-violet-deep shadow-soft active:scale-90">→</button>
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
                ? "You found the glowing lotus at the heart of the garden."
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
