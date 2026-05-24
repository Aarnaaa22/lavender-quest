import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";

type EntityKind = "berry" | "berry-rare" | "rock" | "bush" | "puddle";
type Entity = {
  id: number;
  kind: EntityKind;
  lane: 0 | 1 | 2;
  x: number; // 0 = far right spawn, increases as it moves left (px traveled)
  collected?: boolean;
  hit?: boolean;
};

type Sparkle = { id: number; x: number; y: number };

const DURATION = 28; // seconds to survive
const TARGET_SCORE = 22;
const LANES = 3;
const BASE_SPEED = 260; // px/s
const SPAWN_BASE = 780; // ms between spawns
const JUMP_MS = 780;
const JUMP_LIFT = 72;

export default function BerryRush({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [lane, setLane] = useState<0 | 1 | 2>(1);
  const [jumping, setJumping] = useState(false);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(3);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [shake, setShake] = useState(false);

  const laneRef = useRef(lane);
  const jumpingRef = useRef(jumping);
  const statusRef = useRef(status);
  const healthRef = useRef(health);
  const scoreRef = useRef(score);
  const wonRef = useRef(false);
  const idRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const lastFrameRef = useRef(0);
  const elapsedRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const trackWidthRef = useRef(800);
  const recentHitRef = useRef<Set<number>>(new Set());

  useEffect(() => { laneRef.current = lane; }, [lane]);
  useEffect(() => { jumpingRef.current = jumping; }, [jumping]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // Track width
  useEffect(() => {
    const update = () => {
      if (trackRef.current) trackWidthRef.current = trackRef.current.clientWidth;
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const moveLane = useCallback((dir: -1 | 1) => {
    if (statusRef.current !== "playing") return;
    setLane((l) => Math.max(0, Math.min(LANES - 1, l + dir)) as 0 | 1 | 2);
  }, []);

  const doJump = useCallback(() => {
    if (statusRef.current !== "playing" || jumpingRef.current) return;
    setJumping(true);
    setTimeout(() => setJumping(false), JUMP_MS);
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") moveLane(-1);
      else if (e.key === "ArrowRight" || e.key === "d") moveLane(1);
      else if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        doJump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveLane, doJump]);

  // Touch swipe
  useEffect(() => {
    let startX = 0, startY = 0, startT = 0;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY; startT = Date.now();
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startT;
      if (dt > 600) return;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        moveLane(dx > 0 ? 1 : -1);
      } else if (-dy > 30) {
        doJump();
      } else if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        doJump();
      }
    };
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [moveLane, doJump]);

  // Timer countdown
  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          // Win on survive
          if (!wonRef.current) {
            wonRef.current = true;
            setStatus("won");
            onWin();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status, onWin]);

  // Main loop
  useEffect(() => {
    let raf = 0;
    const loop = (ts: number) => {
      if (statusRef.current !== "playing") {
        lastFrameRef.current = 0;
        raf = requestAnimationFrame(loop);
        return;
      }
      if (!lastFrameRef.current) lastFrameRef.current = ts;
      const dt = (ts - lastFrameRef.current) / 1000;
      lastFrameRef.current = ts;
      elapsedRef.current += dt;

      // Difficulty ramp
      const speed = BASE_SPEED + Math.min(140, elapsedRef.current * 5);
      const spawnInterval = Math.max(420, SPAWN_BASE - elapsedRef.current * 12);

      // Move entities
      setEntities((prev) => {
        const moved = prev
          .map((e) => ({ ...e, x: e.x + speed * dt }))
          .filter((e) => e.x < trackWidthRef.current + 80);

        // Collision check: character is at x = ~80px from left, sized 56px
        const charLeft = 60;
        const charRight = 120;
        for (const e of moved) {
          if (e.collected || e.hit) continue;
          if (e.lane !== laneRef.current) continue;
          // x is distance traveled from right; actual left = trackWidth - x
          const exLeft = trackWidthRef.current - e.x;
          const exRight = exLeft + 48;
          if (exRight < charLeft || exLeft > charRight) continue;
          if (recentHitRef.current.has(e.id)) continue;

          if (e.kind === "berry" || e.kind === "berry-rare") {
            recentHitRef.current.add(e.id);
            e.collected = true;
            const inc = e.kind === "berry-rare" ? 3 : 1;
            const next = scoreRef.current + inc;
            scoreRef.current = next;
            setScore(next);
            // sparkle
            const sx = charLeft + 30;
            const sy = laneY(e.lane);
            const sid = Date.now() + Math.random();
            setSparkles((s) => [...s, { id: sid, x: sx, y: sy }]);
            setTimeout(() => setSparkles((s) => s.filter((p) => p.id !== sid)), 700);
            if (next >= TARGET_SCORE && !wonRef.current) {
              wonRef.current = true;
              setStatus("won");
              onWin();
            }
          } else {
            // obstacle — jump avoids rocks/bushes, not puddles
            if (jumpingRef.current && e.kind !== "puddle") continue;
            recentHitRef.current.add(e.id);
            e.hit = true;
            setShake(true);
            setTimeout(() => setShake(false), 280);
            const nh = healthRef.current - 1;
            healthRef.current = nh;
            setHealth(nh);
            if (nh <= 0 && !wonRef.current) {
              wonRef.current = true;
              setStatus("lost");
            }
          }
        }
        return moved;
      });

      // Spawn
      if (ts - lastSpawnRef.current > spawnInterval) {
        lastSpawnRef.current = ts;
        const roll = Math.random();
        let kind: EntityKind;
        if (roll < 0.55) kind = "berry";
        else if (roll < 0.62) kind = "berry-rare";
        else if (roll < 0.78) kind = "rock";
        else if (roll < 0.9) kind = "bush";
        else kind = "puddle";
        const newLane = Math.floor(Math.random() * LANES) as 0 | 1 | 2;
        setEntities((prev) => [
          ...prev,
          { id: idRef.current++, kind, lane: newLane, x: 0 },
        ]);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onWin]);

  const reset = () => {
    setLane(1);
    setJumping(false);
    setScore(0);
    setHealth(3);
    setTimeLeft(DURATION);
    setEntities([]);
    setSparkles([]);
    setStatus("playing");
    scoreRef.current = 0;
    healthRef.current = 3;
    wonRef.current = false;
    elapsedRef.current = 0;
    lastFrameRef.current = 0;
    lastSpawnRef.current = 0;
    recentHitRef.current = new Set();
  };

  const laneHeight = 96;
  const laneY = (l: number) => 40 + l * laneHeight;

  return (
    <main
      className="relative min-h-screen overflow-hidden select-none"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.88 0.07 295) 0%, oklch(0.82 0.1 300) 35%, oklch(0.75 0.13 305) 70%, oklch(0.68 0.12 40) 100%)",
      }}
    >
      {/* Parallax sky layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1/2"
             style={{ background: "radial-gradient(ellipse at 20% 30%, oklch(0.95 0.05 295 / 0.6), transparent 60%)" }} />
        <div className="absolute inset-x-0 top-10 h-1/2"
             style={{ background: "radial-gradient(ellipse at 80% 20%, oklch(0.92 0.08 320 / 0.5), transparent 55%)" }} />
        {/* Drifting clouds */}
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="absolute text-3xl opacity-70"
            style={{
              top: `${5 + i * 9}%`,
              left: `${(i * 23) % 100}%`,
              animation: `br-cloud ${28 + i * 6}s linear infinite`,
              animationDelay: `${-i * 5}s`,
            }}
          >☁️</span>
        ))}
        {/* Palm trees back layer */}
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="absolute text-5xl opacity-60"
            style={{
              bottom: "42%",
              left: `${(i * 30 + 5) % 110}%`,
              animation: `br-parallax-slow 18s linear infinite`,
              animationDelay: `${-i * 4}s`,
              filter: "blur(0.5px) hue-rotate(-10deg)",
            }}
          >🌴</span>
        ))}
        {/* Floating particles */}
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={`p${i}`} className="absolute rounded-full"
            style={{
              top: `${Math.random() * 80}%`,
              left: `${Math.random() * 100}%`,
              width: 3 + Math.random() * 4,
              height: 3 + Math.random() * 4,
              background: "oklch(0.95 0.1 305 / 0.8)",
              boxShadow: "0 0 10px oklch(0.85 0.15 305)",
              animation: `br-float ${6 + Math.random() * 6}s ease-in-out infinite`,
              animationDelay: `${-Math.random() * 6}s`,
            }}
          />
        ))}
      </div>

      {/* Top bar */}
      <header className="relative z-30 flex items-center justify-between gap-3 p-4 sm:p-6">
        <Link
          to="/map"
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
        >
          ← Map
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full glass px-3 sm:px-4 py-2 shadow-soft">
            <span className="text-xs font-semibold text-violet-deep/70">🍇 </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{score}</span>
            <span className="text-xs font-semibold text-violet-deep/70">/{TARGET_SCORE}</span>
          </div>
          <div className="rounded-full glass px-3 sm:px-4 py-2 shadow-soft">
            <span className="text-sm">{"💜".repeat(Math.max(0, health))}{"🤍".repeat(Math.max(0, 3 - health))}</span>
          </div>
          <div className="rounded-full glass px-3 sm:px-4 py-2 shadow-soft">
            <span className="text-xs font-semibold text-violet-deep/70">⏱ </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{timeLeft}s</span>
          </div>
        </div>
      </header>

      <p className="relative z-30 text-center text-xs font-semibold text-violet-deep/70 tracking-wide">
        Level {levelId} · Berry Rush 🍇 — arrows / swipe to move · space / tap to jump
      </p>

      {/* Track */}
      <div className="relative z-20 mx-auto mt-3 px-2 sm:px-6 max-w-4xl">
        <div
          ref={trackRef}
          className={`relative rounded-[2rem] overflow-hidden shadow-glow ${shake ? "br-shake" : ""}`}
          style={{
            height: laneHeight * LANES + 60,
            background:
              "linear-gradient(180deg, oklch(0.78 0.1 305) 0%, oklch(0.72 0.12 35) 60%, oklch(0.65 0.13 40) 100%)",
            border: "1px solid oklch(0.95 0.05 300 / 0.4)",
          }}
        >
          {/* Lane separators */}
          {Array.from({ length: LANES + 1 }).map((_, i) => (
            <div key={i} className="absolute inset-x-0"
              style={{
                top: 16 + i * laneHeight,
                height: 1,
                background: "oklch(0.95 0.05 305 / 0.35)",
                boxShadow: "0 0 8px oklch(0.95 0.1 305 / 0.5)",
              }}
            />
          ))}
          {/* Moving ground stripes */}
          <div className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 60px, oklch(0.95 0.05 300 / 0.4) 60px 62px)",
              animation: "br-ground 0.6s linear infinite",
            }}
          />

          {/* Character */}
          <div
            className="absolute"
            style={{
              left: 60,
              top: laneY(lane) - 8,
              transition: "top 0.22s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <div
              className="size-14 rounded-full flex items-center justify-center text-3xl shadow-glow"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, oklch(0.98 0.04 305), oklch(0.85 0.12 300) 70%, oklch(0.7 0.15 295))",
                animation: jumping
                  ? `br-jump ${JUMP_MS}ms cubic-bezier(0.33,0.9,0.4,1) forwards`
                  : "br-run 0.4s ease-in-out infinite",
                transformOrigin: "center bottom",
              }}
            >
              🐰
            </div>
            {/* Shadow */}
            <div className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                top: 60,
                width: 44,
                height: 6,
                background: "oklch(0.3 0.08 295 / 0.4)",
                filter: "blur(3px)",
                animation: jumping ? `br-shadow ${JUMP_MS}ms ease-in-out forwards` : undefined,
              }}
            />
          </div>


          {/* Entities */}
          {entities.map((e) => {
            const left = trackWidthRef.current - e.x;
            const top = laneY(e.lane);
            if (e.collected) return null;
            return (
              <div
                key={e.id}
                className={e.hit ? "br-hit" : ""}
                style={{
                  position: "absolute",
                  left,
                  top: top - 4,
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: e.kind === "berry-rare" ? 38 : 32,
                  filter:
                    e.kind === "berry-rare"
                      ? "drop-shadow(0 0 12px oklch(0.85 0.2 305))"
                      : e.kind === "berry"
                      ? "drop-shadow(0 0 6px oklch(0.8 0.18 305))"
                      : "none",
                  animation: e.kind.startsWith("berry") ? "br-bob 1.5s ease-in-out infinite" : undefined,
                }}
              >
                {e.kind === "berry" && "🍇"}
                {e.kind === "berry-rare" && "🫐"}
                {e.kind === "rock" && "🪨"}
                {e.kind === "bush" && "🌿"}
                {e.kind === "puddle" && "💧"}
              </div>
            );
          })}

          {/* Sparkles */}
          {sparkles.map((s) => (
            <div key={s.id} className="absolute pointer-events-none"
              style={{ left: s.x, top: s.y, animation: "br-spark 0.7s ease-out forwards" }}
            >
              <span className="text-2xl">✨</span>
            </div>
          ))}
        </div>

        {/* Mobile controls */}
        <div className="mt-4 flex items-center justify-between gap-3 sm:hidden">
          <button
            onClick={() => moveLane(-1)}
            className="flex-1 rounded-full glass px-5 py-3 text-lg font-bold text-violet-deep shadow-soft active:scale-95 transition"
          >←</button>
          <button
            onClick={doJump}
            className="flex-1 rounded-full bg-button-grad px-5 py-3 text-sm font-bold text-primary-foreground shadow-glow active:scale-95 transition"
          >Jump ↑</button>
          <button
            onClick={() => moveLane(1)}
            className="flex-1 rounded-full glass px-5 py-3 text-lg font-bold text-violet-deep shadow-soft active:scale-95 transition"
          >→</button>
        </div>
      </div>

      {/* End modal */}
      {status !== "playing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-violet-deep/40 backdrop-blur-md animate-[fade-up_0.4s_ease-out]">
          <div className="relative w-full max-w-md rounded-[2rem] glass shadow-glow p-8 sm:p-10 text-center animate-[zoom-in_0.5s_cubic-bezier(0.16,1,0.3,1)]">
            <div className={`mx-auto size-24 rounded-full flex items-center justify-center text-5xl shadow-glow animate-float ${status === "won" ? "bg-button-grad" : "bg-gradient-to-br from-rose-400 to-pink-500"}`}>
              {status === "won" ? "💜" : "🥀"}
            </div>
            <h2 className="mt-6 text-3xl sm:text-4xl font-bold text-gradient">
              {status === "won" ? "Path Cleared" : "Try Again"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {status === "won"
                ? `You collected ${score} berries on the island path!`
                : "The path got the better of you this time."}
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

      <style>{`
        @keyframes br-run {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-4px) rotate(3deg); }
        }
        @keyframes br-jump {
          0%   { transform: translateY(0) scaleY(0.9) scaleX(1.05); }
          15%  { transform: translateY(-${JUMP_LIFT}px) scaleY(1.1) scaleX(0.92) rotate(-10deg); }
          50%  { transform: translateY(-${JUMP_LIFT}px) rotate(0deg); }
          85%  { transform: translateY(-${JUMP_LIFT * 0.4}px) rotate(8deg); }
          100% { transform: translateY(0) scaleY(0.95) scaleX(1.05); }
        }
        @keyframes br-shadow {
          0%, 100% { transform: scaleX(1); opacity: 0.6; }
          50%      { transform: scaleX(0.55); opacity: 0.3; }
        }
        @keyframes br-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes br-ground {
          from { background-position: 0 0; }
          to { background-position: -62px 0; }
        }
        @keyframes br-cloud {
          from { transform: translateX(110vw); }
          to { transform: translateX(-20vw); }
        }
        @keyframes br-parallax-slow {
          from { transform: translateX(0); }
          to { transform: translateX(-120vw); }
        }
        @keyframes br-float {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-20px); opacity: 1; }
        }
        @keyframes br-spark {
          from { transform: scale(0.6); opacity: 1; }
          to { transform: scale(2.2) translateY(-20px); opacity: 0; }
        }
        @keyframes br-shakeKf {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .br-shake { animation: br-shakeKf 0.25s ease-in-out; }
        .br-hit { animation: br-shakeKf 0.25s ease-in-out; opacity: 0.6; }
      `}</style>
    </main>
  );
}
