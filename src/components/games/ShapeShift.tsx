import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Tile = {
  id: number;
  odd: boolean;
  icon: string;
  hue: number;
  rotate: number;
  scale: number;
};

const GRID_SMALL = 3;
const GRID_LARGE = 4;
const TIME_LIMIT = 28;
const PENALTY = 2;

const ITEM_PAIRS = [
  { base: "🌸", odd: "💮" },
  { base: "🍓", odd: "🍒" },
  { base: "🍬", odd: "🍭" },
  { base: "🍇", odd: "🫐" },
  { base: "🍩", odd: "🍪" },
];

const TILE_COLORS = [288, 312, 340, 260, 308];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function TapTheOddOne({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [gridSize, setGridSize] = useState(GRID_LARGE);
  const [tiles, setTiles] = useState<Tile[]>(() => []);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [status, setStatus] = useState<"playing" | "finished">("playing");
  const [activePop, setActivePop] = useState<number | null>(null);
  const [wrongShake, setWrongShake] = useState(false);
  const completedRef = useRef(false);
  const nextIdRef = useRef(1);

  const createBoard = useCallback((size: number) => {
    const theme = ITEM_PAIRS[Math.floor(Math.random() * ITEM_PAIRS.length)];
    const baseHue = TILE_COLORS[Math.floor(Math.random() * TILE_COLORS.length)];
    const oddIndex = Math.floor(Math.random() * size * size);

    return Array.from({ length: size * size }, (_, index) => {
      const odd = index === oddIndex;
      const icon = odd ? theme.odd : theme.base;
      return {
        id: nextIdRef.current++,
        odd,
        icon,
        hue: baseHue + (odd ? 8 : 0),
        rotate: odd ? randomBetween(-6, 6) : randomBetween(-3, 3),
        scale: odd ? 1.06 : 1,
      };
    });
  }, []);

  const resetBoard = useCallback(() => {
    setTiles(createBoard(gridSize));
    setActivePop(null);
  }, [createBoard, gridSize]);

  useEffect(() => {
    const handleResize = () => setGridSize(window.innerWidth < 640 ? GRID_SMALL : GRID_LARGE);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    resetBoard();
  }, [gridSize, resetBoard]);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setStatus("finished");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === "finished" && !completedRef.current) {
      completedRef.current = true;
      onWin();
    }
  }, [onWin, status]);

  const handleTileClick = useCallback(
    (tile: Tile) => {
      if (status !== "playing") return;
      if (tile.odd) {
        setScore((current) => current + 1);
        setActivePop(tile.id);
        window.setTimeout(() => setActivePop(null), 220);
        resetBoard();
        return;
      }

      setTimeLeft((current) => Math.max(0, current - PENALTY));
      setWrongShake(true);
      window.setTimeout(() => setWrongShake(false), 220);
    },
    [resetBoard, status],
  );

  const explanation = useMemo(
    () =>
      status === "playing"
        ? "Tap the odd item before the lavender timer runs out."
        : "Your sharp eyes finished the round.",
    [status],
  );

  const gridColumns = gridSize;
  const boardClasses = `odd-one-board ${wrongShake ? "odd-one-board-shake" : ""}`;

  return (
    <main className="relative min-h-screen overflow-hidden odd-one-bg select-none">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.35),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(191,148,255,0.18),_transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,_rgba(255,255,255,0.28),_transparent_46%)]" />

      <header className="relative z-20 mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/map"
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
        >
          ← Map
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="rounded-full glass px-4 py-2 text-violet-deep shadow-soft">
            <span className="text-xs uppercase tracking-[0.32em] text-violet-500">Score</span>
            <div className="mt-1 text-2xl font-semibold text-violet-deep tabular-nums">{score}</div>
          </div>
          <div className="rounded-full glass px-4 py-2 text-violet-deep shadow-soft">
            <span className="text-xs uppercase tracking-[0.32em] text-violet-500">Timer</span>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${timeLeft <= 6 ? "text-destructive" : "text-violet-deep"}`}>{timeLeft}s</div>
          </div>
        </div>
      </header>

      <section className="relative z-20 mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-glow backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-violet-200/70">Tap the Odd One</p>
              <h1 className="mt-3 text-4xl font-bold text-white">Sharp Eyes 💜</h1>
            </div>
            <p className="max-w-xl text-sm leading-6 text-violet-deep/80">Find the subtly different lavender item in each grid. A wrong tap steals time, so stay quick and focused.</p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-violet-950/60 p-4 text-sm text-violet-100 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.34em] text-violet-300/70">How to play</p>
              <p className="mt-3">Tap the only item that differs from the rest. It is easy to miss, but not impossible to catch.</p>
            </div>
            <div className="rounded-3xl bg-violet-950/60 p-4 text-sm text-violet-100 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.34em] text-violet-300/70">Penalty</p>
              <p className="mt-3">Wrong taps deduct {PENALTY} seconds from the timer. Keep your rhythm and don’t hesitate.</p>
            </div>
            <div className="rounded-3xl bg-violet-950/60 p-4 text-sm text-violet-100 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.34em] text-violet-300/70">Goal</p>
              <p className="mt-3">Score as many correct taps as possible before time runs out.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        <div className={boardClasses} style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}>
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleTileClick(tile)}
              className={`odd-one-tile ${tile.odd ? "odd" : ""} ${activePop === tile.id ? "odd-one-pop" : ""}`}
              style={{ "--hue": tile.hue, "--rotate": `${tile.rotate}deg`, "--scale": tile.scale } as React.CSSProperties}
            >
              <span className="odd-one-icon">{tile.icon}</span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-violet-deep/70">{explanation}</p>
      </section>

      {status === "finished" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-violet-deep/40 px-4 py-6 backdrop-blur-lg">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#1f0b33]/95 p-8 text-center shadow-[0_0_80px_rgba(140,80,255,0.32)]">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-500 text-4xl text-white shadow-glow">💜</div>
            <h2 className="text-3xl font-bold text-white">Sharp Eyes 💜</h2>
            <p className="mt-3 text-sm text-violet-200/80">You scored {score} correct taps in {TIME_LIMIT} seconds. Great reflexes!</p>
            <button
              type="button"
              onClick={onReturn}
              className="mt-6 inline-flex rounded-full bg-button-grad px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-105"
            >
              Return to Map
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
