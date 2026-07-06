import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";

import { LEVELS, TOTAL_LEVELS, type Level } from "@/lib/levels";
import { loadProgress, resetProgress, type Progress } from "@/lib/storage";
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
  const [progress, setProgress] = useState<Progress>({ currentLevel: 1, completed: [], credits: 5 });
  const [openLevel, setOpenLevel] = useState<Level | null>(null);
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setMounted(true);
    // Coordinated reveal handoff from landing page whiteout.
    try {
      if (sessionStorage.getItem("la-reveal") === "1") {
        sessionStorage.removeItem("la-reveal");
        setRevealing(true);
        const raf = requestAnimationFrame(() => {
          const t = window.setTimeout(() => setRevealing(false), 1100);
          (window as unknown as { __laRevealTimer?: number }).__laRevealTimer = t;
        });
        return () => {
          cancelAnimationFrame(raf);
          const t = (window as unknown as { __laRevealTimer?: number }).__laRevealTimer;
          if (t) window.clearTimeout(t);
        };
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const player = useMemo(
    () => LEVELS.find((l) => l.id === progress.currentLevel) ?? LEVELS[0],
    [progress.currentLevel],
  );

  const clouds = [
    { left: "12%", top: "10%", size: "w-36 h-16", delay: "0s" },
    { left: "68%", top: "8%", size: "w-44 h-20", delay: "3s" },
    { left: "34%", top: "18%", size: "w-32 h-14", delay: "6s" },
  ];

  const boats = [
    { left: "8%", top: "72%", delay: "0s", duration: "14s" },
    { left: "74%", top: "62%", delay: "2s", duration: "18s" },
  ];

  const roadsideDetails = [
    { id: "stall-1", left: "26%", top: "64%", label: "Candy stall", icon: "🍭" },
    { id: "cart-1", left: "54%", top: "52%", label: "Ice cream cart", icon: "🍦" },
    { id: "deco-1", left: "70%", top: "72%", label: "Twinkle post", icon: "✨" },
    { id: "deco-2", left: "38%", top: "34%", label: "Sweet sign", icon: "🍬" },
  ];

  const getRoadCurve = useCallback((from: Level, to: Level) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const controlOffset = Math.min(18, Math.max(10, Math.abs(dx) * 0.7 + Math.abs(dy) * 0.4));
    const controlX1 = from.x + dx * 0.35 + (dy > 0 ? controlOffset : -controlOffset);
    const controlY1 = from.y + dy * 0.25 - controlOffset * 0.45;
    const controlX2 = from.x + dx * 0.65 + (dy > 0 ? -controlOffset : controlOffset);
    const controlY2 = from.y + dy * 0.75 + controlOffset * 0.55;
    return `M ${from.x} ${from.y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${to.x} ${to.y}`;
  }, []);

  const hours = clock.getHours() % 12;
  const minutes = clock.getMinutes();
  const seconds = clock.getSeconds();
  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;

  const isUnlocked = (id: number) => id <= progress.currentLevel;
  const isDone = (id: number) => progress.completed.includes(id);

  const handleLevelSelect = useCallback(
    (level: Level) => {
      if (!isUnlocked(level.id)) return;
      setOpenLevel(level);
    },
    [isUnlocked],
  );

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

      <header className="relative z-10 max-w-6xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform">
            ← Home
          </Link>
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-violet-900">
            {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">Lavender Island</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {progress.completed.length} / {TOTAL_LEVELS} treasures collected
          </p>
        </div>

        <button
          onClick={onReset}
          className="rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform"
        >
          Reset
        </button>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-[2rem] transition-all duration-700">
          <div
            className={`relative aspect-[16/10] w-full rounded-[2rem] overflow-hidden glass shadow-glow transition-all duration-700 ${
              mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          >
            <div
              className="absolute inset-0"
              style={{
                transform: "translate(0, 0) scale(1)",
                transformStyle: "preserve-3d",
                transition: "transform 0.8s ease-out",
              }}
            >
              <div
                className="absolute inset-0 map-layer map-background-layer"
                style={{
                  transform: "translateZ(0)",
                }}
              >
                <div className="absolute inset-0 bg-sky-depth" />
                {clouds.map((cloud, index) => (
                  <div
                    key={index}
                    className={`absolute ${cloud.size} rounded-full bg-white/70 blur-0 opacity-85 map-cloud`}
                    style={{ left: cloud.left, top: cloud.top, animationDelay: cloud.delay }}
                  />
                ))}
              </div>

              <div
                className="absolute inset-0 map-layer map-midground-layer"
                style={{
                  transform: "translateZ(0)",
                }}
              >
                <img
                  src={islandImg}
                  alt="Lavender island map"
                  className="absolute inset-0 size-full object-cover"
                  width={1536}
                  height={1024}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-violet-deep/30" />
                {boats.map((boat, index) => (
                  <div
                    key={index}
                    className="absolute flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold text-violet-950 map-boat"
                    style={{ left: boat.left, top: boat.top, animationDelay: boat.delay, animationDuration: boat.duration }}
                  >
                    ⛵
                  </div>
                ))}
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl"
                  style={{ left: `${LEVELS[TOTAL_LEVELS - 1].x}%`, top: `${LEVELS[TOTAL_LEVELS - 1].y - 8}%` }}
                >
                  🏰
                </div>
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl"
                  style={{ left: `${LEVELS[TOTAL_LEVELS - 1].x + 10}%`, top: `${LEVELS[TOTAL_LEVELS - 1].y + 8}%` }}
                >
                  🕰️
                </div>
              </div>

              <div
                className="absolute inset-0 map-layer map-foreground-layer"
                style={{
                  transform: "translateZ(0)",
                }}
              >
                <svg className="absolute inset-0 size-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="roadGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="rgba(255,221,255,0.95)" />
                      <stop offset="50%" stopColor="rgba(241,185,255,0.95)" />
                      <stop offset="100%" stopColor="rgba(195,152,255,0.95)" />
                    </linearGradient>
                    <linearGradient id="roadHighlight" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
                    </linearGradient>
                  </defs>
                  {LEVELS.slice(0, -1).map((l, i) => {
                    const next = LEVELS[i + 1];
                    const path = getRoadCurve(l, next);
                    return (
                      <g key={`road-${l.id}`}>
                        <path
                          d={path}
                          className="map-road"
                          stroke="url(#roadGradient)"
                          strokeWidth="5"
                          vectorEffect="non-scaling-stroke"
                        />
                        <path
                          d={path}
                          className="map-road map-road-highlight"
                          stroke="url(#roadHighlight)"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    );
                  })}
                </svg>

                {roadsideDetails.map((detail) => (
                  <div
                    key={detail.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-violet-deep shadow-soft backdrop-blur"
                    style={{ left: detail.left, top: detail.top }}
                  >
                    <span>{detail.icon}</span>
                    <span>{detail.label}</span>
                  </div>
                ))}

                {LEVELS.map((l) => (
                  <div
                    key={`zone-${l.id}`}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/5 shadow-soft map-zone"
                    style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.id * 4 + 28}px`, height: `${l.id * 4 + 24}px` }}
                  />
                ))}


                {LEVELS.map((l) => {
                  const unlocked = isUnlocked(l.id);
                  const done = isDone(l.id);
                  const isCurrent = l.id === progress.currentLevel;
                  return (
                    <button
                      key={l.id}
                      onClick={() => handleLevelSelect(l)}
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

                <div
                  className="absolute -translate-x-1/2 pointer-events-none transition-all duration-700 ease-out map-player-shadow"
                  style={{ left: `${player.x}%`, top: `${player.y}%`, transform: `translate(-50%, calc(-50% - 38px))` }}
                >
                  <span className="text-3xl animate-float drop-shadow-[0_4px_14px_rgba(120,60,180,0.5)]">
                    🧚‍♀️
                  </span>
                </div>
              </div>
            </div>
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
