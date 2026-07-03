import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";

import { LEVELS, TOTAL_LEVELS, type Level } from "@/lib/levels";
import { loadProgress, resetProgress, skipLevel, SKIP_COST, type Progress } from "@/lib/storage";
import islandImg from "@/assets/lavender-island.jpg";


export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Island Map — Lavender Adventure" },
      { name: "description", content: "Explore ten enchanted locations across the lavender island and complete each mini game." },
      { property: "og:title", content: "Lavender Island Map" },
      { property: "og:description", content: "Ten mini games across a dreamy lavender island." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const [progress, setProgress] = useState<Progress>({ currentLevel: 1, completed: [], credits: 10 });
  const [openLevel, setOpenLevel] = useState<Level | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setMounted(true);
  }, []);

  const player = useMemo(
    () => LEVELS.find((l) => l.id === progress.currentLevel) ?? LEVELS[0],
    [progress.currentLevel],
  );

  const isUnlocked = (id: number) => id <= progress.currentLevel;
  const isDone = (id: number) => progress.completed.includes(id);

  // Re-load progress when modal closes (so completions from /game/$id reflect)
  useEffect(() => {
    if (!openLevel) setProgress(loadProgress());
  }, [openLevel]);


  function onReset() {
    setProgress(resetProgress());
  }

  return (
    <main className="relative min-h-screen px-4 sm:px-8 py-8">
      <AmbientBackground density={20} />

      <header className="relative z-10 max-w-6xl mx-auto flex items-center justify-between gap-4 mb-6">
        <Link to="/" className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform">
          ← Home
        </Link>
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">Lavender Island</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {progress.completed.length} / {TOTAL_LEVELS} treasures collected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="rounded-full glass px-3 py-2 text-sm font-bold text-violet-deep shadow-soft flex items-center gap-1"
            title="Credits · earn 3 per level · skip costs 5"
          >
            <span>💎</span>
            <span className="tabular-nums">{progress.credits}</span>
          </div>
          <button
            onClick={onReset}
            className="rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform"
          >
            Reset
          </button>
        </div>

      </header>

      <div className="relative z-10 max-w-6xl mx-auto">
        <div
          className={`relative aspect-[16/10] w-full rounded-[2rem] overflow-hidden glass shadow-glow transition-all duration-700 ${
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <img
            src={islandImg}
            alt="Lavender island map"
            className="absolute inset-0 size-full object-cover"
            width={1536}
            height={1024}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-violet-deep/30" />

          {/* Dotted paths */}
          <svg className="absolute inset-0 size-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {LEVELS.slice(0, -1).map((l, i) => {
              const next = LEVELS[i + 1];
              const unlocked = isDone(l.id);
              return (
                <line
                  key={l.id}
                  x1={l.x}
                  y1={l.y}
                  x2={next.x}
                  y2={next.y}
                  stroke={unlocked ? "white" : "rgba(255,255,255,0.5)"}
                  strokeWidth={0.5}
                  strokeDasharray="1.2 1.6"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter: unlocked
                      ? "drop-shadow(0 0 6px rgba(255,200,255,0.9))"
                      : "drop-shadow(0 1px 2px rgba(80,40,120,0.4))",
                    animation: unlocked ? "dash 30s linear infinite" : undefined,
                  }}
                />
              );
            })}
          </svg>

          {/* Level nodes */}
          {LEVELS.map((l) => {
            const unlocked = isUnlocked(l.id);
            const done = isDone(l.id);
            const isCurrent = l.id === progress.currentLevel;
            return (
              <button
                key={l.id}
                onClick={() => unlocked && setOpenLevel(l)}
                disabled={!unlocked}
                className={`group absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                  unlocked ? "cursor-pointer hover:scale-110" : "cursor-not-allowed"
                }`}
                style={{ left: `${l.x}%`, top: `${l.y}%` }}
                aria-label={`${l.name} — ${unlocked ? (done ? "completed" : "unlocked") : "locked"}`}
              >
                <span
                  className={`flex items-center justify-center size-12 sm:size-14 rounded-full text-2xl shadow-node transition-all ${
                    done
                      ? "bg-button-grad text-white"
                      : unlocked
                        ? "bg-white/95 text-violet-deep"
                        : "bg-white/40 text-violet-deep/50 backdrop-blur"
                  } ${isCurrent ? "animate-pulse-glow" : ""}`}
                >
                  {done ? "💜" : unlocked ? l.emoji : "🔒"}
                </span>
                <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full glass px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold text-violet-deep opacity-0 group-hover:opacity-100 transition-opacity">
                  {l.name}
                </span>
              </button>
            );
          })}

          {/* Player marker */}
          <div
            className="absolute -translate-x-1/2 pointer-events-none transition-all duration-700 ease-out"
            style={{ left: `${player.x}%`, top: `${player.y}%`, transform: `translate(-50%, calc(-50% - 38px))` }}
          >
            <span className="text-3xl animate-float drop-shadow-[0_4px_8px_rgba(120,60,180,0.45)]">
              🧚‍♀️
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-violet-deep">
          <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 font-semibold">
            <span className="size-3 rounded-full bg-button-grad" /> Completed
          </span>
          <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 font-semibold">
            <span className="size-3 rounded-full bg-white" /> Unlocked
          </span>
          <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 font-semibold">
            <span className="size-3 rounded-full bg-white/40" /> Locked
          </span>
        </div>
      </div>

      {openLevel && (
        <GameModal
          level={openLevel}
          alreadyDone={isDone(openLevel.id)}
          onClose={() => setOpenLevel(null)}
        />
      )}
    </main>
  );
}

function GameModal({
  level,
  alreadyDone,
  onClose,
}: {
  level: Level;
  alreadyDone: boolean;
  onClose: () => void;
}) {
  const isAvailable = level.id === 1;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-violet-deep/40 backdrop-blur-md animate-[fade-up_0.3s_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-[2rem] glass shadow-glow p-8 text-center animate-[zoom-in_0.4s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 size-9 rounded-full glass text-violet-deep hover:scale-110 transition-transform"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="mx-auto size-20 rounded-full bg-button-grad flex items-center justify-center text-4xl shadow-glow animate-float">
          {level.emoji}
        </div>

        <p className="mt-5 text-xs font-bold tracking-widest uppercase text-violet-deep/70">
          Level {level.id} · {level.name}
        </p>
        <h2 className="mt-2 text-3xl font-bold text-gradient">{level.game}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{level.description}</p>

        {!isAvailable && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-blossom/30 px-4 py-1.5 text-xs font-semibold text-violet-deep">
            🚧 Coming soon — game in development
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3">
          <Link
            to="/game/$id"
            params={{ id: String(level.id) }}
            className="w-full rounded-full bg-button-grad px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-95 transition-transform"
          >
            {isAvailable ? (alreadyDone ? "Replay level →" : "Play now →") : "Peek inside →"}
          </Link>
          <button
            onClick={onClose}
            className="w-full rounded-full glass px-6 py-3 text-sm font-semibold text-violet-deep hover:scale-[1.02] transition-transform"
          >
            Back to map
          </button>
        </div>
      </div>
    </div>
  );
}
