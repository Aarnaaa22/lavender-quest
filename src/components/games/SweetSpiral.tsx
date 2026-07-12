import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Sweet Spiral — Level 10
 * Helix-jump style: bouncing candy ball descends a rotating spiral tower.
 * Drag left/right anywhere on the play area to rotate the tower.
 * Guide the ball through gaps in the platforms, avoiding chocolate slices.
 */

type SliceType = "safe" | "dissolving" | "gap" | "forbidden";

type Platform = {
  y: number;                // world Y (top of platform)
  slices: SliceType[];      // length SLICES
  style: number;            // 0..N-1 dessert palette
  star: number | null;      // slice index containing a star (or null)
  starTaken: boolean;
};

const CANVAS_W = 360;
const CANVAS_H = 620;
const CENTER_X = CANVAS_W / 2;
const BALL_Y_SCREEN = 170;   // ball's fixed y in the viewport
const BALL_R = 16;

const SLICES = 12;
const SLICE_ANGLE = (Math.PI * 2) / SLICES;
const RING_RADIUS = 118;
const RING_HEIGHT = 26;
const SLICE_ARC_WIDTH = 44;  // base width of each slice tile at front

const PLATFORM_COUNT = 14;
const PLATFORM_GAP = 96;
const FIRST_PLATFORM_Y = 260;

const GRAVITY = 0.55;
const BOUNCE_V = -12.2;
const MAX_FALL_V = 16;

const DESSERT_PALETTES: { safe: string; dissolving: string; forbidden: string; ring: string }[] = [
  { safe: "linear-gradient(180deg,#f7d3ff,#c69dff)", dissolving: "linear-gradient(180deg,#ffdff0,#f5a9d0)", forbidden: "linear-gradient(180deg,#5a3a2a,#3a2418)", ring: "#a074d8" },
  { safe: "linear-gradient(180deg,#e9d8ff,#9f7be0)", dissolving: "linear-gradient(180deg,#ffe3f2,#f2a3c8)", forbidden: "linear-gradient(180deg,#4a2c1e,#2f1a10)", ring: "#7d55c4" },
  { safe: "linear-gradient(180deg,#f4e0ff,#b48be6)", dissolving: "linear-gradient(180deg,#ffd6e8,#e097c1)", forbidden: "linear-gradient(180deg,#5c3624,#39200f)", ring: "#8f6bd6" },
];

function generateTower(): Platform[] {
  const platforms: Platform[] = [];
  for (let i = 0; i < PLATFORM_COUNT; i++) {
    // Difficulty ramp
    const progress = i / (PLATFORM_COUNT - 1);
    const forbiddenCount = i < 3 ? 1 : i < 8 ? 2 : 3;
    const dissolvingCount = i < 3 ? 1 : i < 8 ? 3 : 4;
    // Ensure at least 2 gaps for solvability (smaller openings later)
    const gapCount = Math.max(2, 4 - Math.floor(progress * 3));

    const types: SliceType[] = Array(SLICES).fill("safe");
    // Randomly assign gaps first
    const indices = Array.from({ length: SLICES }, (_, k) => k);
    shuffle(indices);
    let cursor = 0;
    for (let g = 0; g < gapCount; g++) types[indices[cursor++]] = "gap";
    for (let g = 0; g < forbiddenCount; g++) types[indices[cursor++]] = "forbidden";
    for (let g = 0; g < dissolvingCount; g++) types[indices[cursor++]] = "dissolving";

    // Ensure at least one contiguous gap opening (adjacent gaps make it fair)
    if (!hasContiguousGap(types)) {
      // convert a safe adjacent to first gap into gap
      const gi = types.indexOf("gap");
      const neighbor = (gi + 1) % SLICES;
      if (types[neighbor] === "safe") types[neighbor] = "gap";
    }

    // Star: sometimes place on a safe or dissolving slice
    let star: number | null = null;
    if (Math.random() < 0.55) {
      const candidates = types.map((t, k) => (t === "safe" || t === "dissolving" ? k : -1)).filter((k) => k >= 0);
      if (candidates.length) star = candidates[Math.floor(Math.random() * candidates.length)];
    }

    platforms.push({
      y: FIRST_PLATFORM_Y + i * PLATFORM_GAP,
      slices: types,
      style: i % DESSERT_PALETTES.length,
      star,
      starTaken: false,
    });
  }
  // Very first platform: force all-safe with one gap to be gentle
  platforms[0].slices = platforms[0].slices.map((t, k) => (k === 0 || k === 1 ? "gap" : "safe"));
  return platforms;
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function hasContiguousGap(types: SliceType[]) {
  for (let i = 0; i < SLICES; i++) {
    if (types[i] === "gap" && types[(i + 1) % SLICES] === "gap") return true;
  }
  return false;
}

function sliceUnderBall(rotationRad: number) {
  // slice i is at angle i*SLICE_ANGLE + rotation; "front" (under ball) = angle wrapped near 0
  const wrapped = ((-rotationRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(wrapped / SLICE_ANGLE) % SLICES;
}

type Particle = { id: number; x: number; y: number; vx: number; vy: number; life: number; color: string };

export default function SweetSpiral({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [platforms, setPlatforms] = useState<Platform[]>(() => generateTower());
  const [rotation, setRotation] = useState(0); // radians
  const [ballWorldY, setBallWorldY] = useState(FIRST_PLATFORM_Y - 60);
  const [status, setStatus] = useState<"playing" | "won" | "lost" | "paused">("playing");
  const [score, setScore] = useState(0);
  const [stars, setStars] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shake, setShake] = useState(false);
  const [slowmo, setSlowmo] = useState(false);

  const ballVYRef = useRef(0);
  const nextPlatformRef = useRef(0); // index of next platform ball can hit
  const rotationRef = useRef(0);
  const rotVelRef = useRef(0);       // inertia rad/frame
  const dragRef = useRef<{ active: boolean; lastX: number; lastT: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const wonRef = useRef(false);
  const particleId = useRef(0);
  const ballWorldYRef = useRef(FIRST_PLATFORM_Y - 60);
  const platformsRef = useRef<Platform[]>(platforms);

  useEffect(() => { rotationRef.current = rotation; }, [rotation]);
  useEffect(() => { ballWorldYRef.current = ballWorldY; }, [ballWorldY]);
  useEffect(() => { platformsRef.current = platforms; }, [platforms]);

  const addParticles = useCallback((x: number, y: number, color: string, n = 10) => {
    setParticles((prev) => {
      const created: Particle[] = [];
      for (let i = 0; i < n; i++) {
        created.push({
          id: particleId.current++,
          x, y,
          vx: (Math.random() - 0.5) * 6,
          vy: -2 - Math.random() * 4,
          life: 32 + Math.random() * 16,
          color,
        });
      }
      return [...prev, ...created];
    });
  }, []);

  // Game loop
  useEffect(() => {
    if (status !== "playing") return;
    let last = performance.now();
    const step = (now: number) => {
      const dtMs = Math.min(48, now - last);
      last = now;
      const factor = (slowmo ? 0.35 : 1) * (dtMs / 16.67);

      // rotation inertia
      if (!dragRef.current?.active) {
        rotationRef.current += rotVelRef.current * factor;
        rotVelRef.current *= Math.pow(0.9, factor);
        if (Math.abs(rotVelRef.current) < 0.0005) rotVelRef.current = 0;
        setRotation(rotationRef.current);
      }

      // ball physics
      ballVYRef.current = Math.min(MAX_FALL_V, ballVYRef.current + GRAVITY * factor);
      let newY = ballWorldYRef.current + ballVYRef.current * factor;

      // check next platform collision only when descending
      const platforms = platformsRef.current;
      const idx = nextPlatformRef.current;
      if (ballVYRef.current > 0 && idx < platforms.length) {
        const p = platforms[idx];
        const topY = p.y;
        if (newY + BALL_R >= topY && ballWorldYRef.current + BALL_R <= topY + 6) {
          // ball reaches this platform's top
          const slice = sliceUnderBall(rotationRef.current);
          const type = p.slices[slice];

          // Star collection: when passing near platform, collect if star at slice
          if (p.star !== null && !p.starTaken && p.star === slice) {
            p.starTaken = true;
            setPlatforms((ps) => ps.map((pp, i) => (i === idx ? { ...pp, starTaken: true } : pp)));
            setStars((s) => s + 1);
            setScore((s) => s + 50);
            addParticles(CENTER_X, BALL_Y_SCREEN, "#ffe27a", 14);
          }

          if (type === "forbidden") {
            newY = topY - BALL_R;
            ballVYRef.current = 0;
            triggerLose(p);
            return;
          } else if (type === "gap") {
            // fall through — advance pointer
            nextPlatformRef.current = idx + 1;
          } else {
            // bounce
            newY = topY - BALL_R;
            ballVYRef.current = BOUNCE_V;
            setScore((s) => s + 10);
            addParticles(CENTER_X, BALL_Y_SCREEN + BALL_R, "#f7d3ff", 6);
            if (type === "dissolving") {
              // convert to gap on this platform
              setPlatforms((ps) =>
                ps.map((pp, i) =>
                  i === idx
                    ? { ...pp, slices: pp.slices.map((s, k) => (k === slice ? "gap" : s)) }
                    : pp,
                ),
              );
              addParticles(CENTER_X, BALL_Y_SCREEN + BALL_R, "#f5a9d0", 10);
            }
          }
        }
      }

      ballWorldYRef.current = newY;
      setBallWorldY(newY);

      // win condition — passed final platform
      if (nextPlatformRef.current >= platforms.length && newY > platforms[platforms.length - 1].y + 60) {
        if (!wonRef.current) {
          wonRef.current = true;
          setStatus("won");
          setScore((s) => s + 100);
          onWin();
        }
      }

      // particles update
      setParticles((prev) =>
        prev
          .map((pt) => ({
            ...pt,
            x: pt.x + pt.vx * factor,
            y: pt.y + pt.vy * factor,
            vy: pt.vy + 0.25 * factor,
            life: pt.life - factor,
          }))
          .filter((pt) => pt.life > 0),
      );

      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slowmo]);

  const triggerLose = (p: Platform) => {
    if (wonRef.current) return;
    wonRef.current = true;
    setShake(true);
    setSlowmo(true);
    addParticles(CENTER_X, BALL_Y_SCREEN, "#8b4bd8", 26);
    setTimeout(() => setShake(false), 380);
    setTimeout(() => {
      setSlowmo(false);
      setStatus("lost");
    }, 520);
  };

  // Pointer drag → rotate
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status !== "playing") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { active: true, lastX: e.clientX, lastT: performance.now() };
    rotVelRef.current = 0;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d?.active) return;
    const dx = e.clientX - d.lastX;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    const drad = dx * 0.012;
    rotationRef.current += drad;
    setRotation(rotationRef.current);
    rotVelRef.current = drad / (dt / 16.67);
    d.lastX = e.clientX;
    d.lastT = now;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) dragRef.current.active = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft") { rotationRef.current -= 0.18; setRotation(rotationRef.current); }
      if (e.code === "ArrowRight") { rotationRef.current += 0.18; setRotation(rotationRef.current); }
      if (e.code === "KeyP" || e.code === "Escape") {
        setStatus((s) => (s === "playing" ? "paused" : s === "paused" ? "playing" : s));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const restart = () => {
    wonRef.current = false;
    ballVYRef.current = 0;
    nextPlatformRef.current = 0;
    rotationRef.current = 0;
    rotVelRef.current = 0;
    ballWorldYRef.current = FIRST_PLATFORM_Y - 60;
    setPlatforms(generateTower());
    setRotation(0);
    setBallWorldY(FIRST_PLATFORM_Y - 60);
    setScore(0);
    setStars(0);
    setParticles([]);
    setStatus("playing");
  };

  const cameraY = ballWorldY - BALL_Y_SCREEN;
  const totalStars = useMemo(() => platforms.filter((p) => p.star !== null).length, [platforms]);
  const progressPct = Math.min(100, Math.max(0, ((nextPlatformRef.current) / PLATFORM_COUNT) * 100));

  return (
    <main
      className="relative min-h-screen overflow-hidden select-none"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.35), transparent 55%), linear-gradient(180deg,#f8ecff 0%,#e8d5ff 45%,#d0b5ff 100%)",
      }}
    >
      {/* Dreamy clouds & candy mountains */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-4 top-16 h-16 w-40 rounded-full bg-white/60 blur-2xl" />
        <div className="absolute right-8 top-28 h-12 w-32 rounded-full bg-white/50 blur-2xl" />
        <div className="absolute left-1/3 top-10 h-10 w-24 rounded-full bg-white/45 blur-xl" />
        <svg className="absolute bottom-0 left-0 w-full opacity-70" viewBox="0 0 400 90" preserveAspectRatio="none">
          <path d="M0,90 L0,60 Q60,20 120,55 T240,50 T400,45 L400,90 Z" fill="url(#mt)" />
          <defs>
            <linearGradient id="mt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c9a6ff" />
              <stop offset="1" stopColor="#8a5fd0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* HUD */}
      <div className="relative z-20 mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="rounded-full glass px-4 py-2 shadow-soft">
          <span className="text-xs font-semibold text-violet-deep/70">Score </span>
          <span className="text-sm font-bold text-violet-deep tabular-nums">{score}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-white/50">
            <div
              className="h-full bg-gradient-to-r from-fuchsia-400 to-violet-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setStatus((s) => (s === "playing" ? "paused" : s === "paused" ? "playing" : s))}
            className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-violet-deep shadow-soft"
          >
            {status === "paused" ? "▶ Resume" : "⏸ Pause"}
          </button>
        </div>
        <div className="rounded-full glass px-4 py-2 shadow-soft">
          <span className="text-xs font-semibold text-violet-deep/70">⭐ </span>
          <span className="text-sm font-bold text-violet-deep tabular-nums">
            {stars}/{totalStars}
          </span>
        </div>
      </div>

      <p className="relative z-20 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-violet-500/80">
        Level {levelId} · Drag to spin the tower
      </p>

      <div className="relative z-10 mx-auto mt-3 flex justify-center px-3">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative overflow-hidden rounded-[2rem] shadow-glow"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            background:
              "linear-gradient(180deg,#faf0ff 0%,#e6d0ff 60%,#d1b8ff 100%)",
            border: "1px solid rgba(255,255,255,0.5)",
            touchAction: "none",
            cursor: "grab",
            animation: shake ? "ss-shake 0.35s ease-in-out" : undefined,
          }}
        >
          {/* Central axis line */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2"
            style={{ background: "linear-gradient(180deg, rgba(180,140,240,0.35), rgba(120,80,200,0.15))" }}
          />

          {/* World (platforms) */}
          <div
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${-cameraY}px)`, transition: "transform 60ms linear" }}
          >
            {platforms.map((p, idx) => (
              <PlatformRing key={idx} platform={p} rotation={rotation} />
            ))}
          </div>

          {/* Ball (fixed screen position) */}
          <div
            className="absolute"
            style={{
              left: CENTER_X - BALL_R,
              top: BALL_Y_SCREEN - BALL_R,
              width: BALL_R * 2,
              height: BALL_R * 2,
            }}
          >
            {/* shadow */}
            <div
              aria-hidden
              className="absolute rounded-[50%]"
              style={{
                left: -4, top: BALL_R * 2 + 2, width: BALL_R * 2 + 8, height: 6,
                background: "radial-gradient(ellipse at center, rgba(60,20,100,0.35), transparent 70%)",
                filter: "blur(2px)",
              }}
            />
            <div
              className="h-full w-full rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #ffffff, #ffb4e2 40%, #d675ff 80%)",
                boxShadow: "0 0 24px rgba(214,117,255,0.9), inset 0 -4px 8px rgba(120,50,180,0.35)",
                animation: "ss-bounce 0.5s ease-in-out infinite alternate",
              }}
            />
          </div>

          {/* Particles */}
          {particles.map((pt) => (
            <span
              key={pt.id}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: pt.x, top: pt.y,
                width: 6, height: 6,
                background: pt.color,
                opacity: Math.min(1, pt.life / 30),
                boxShadow: `0 0 8px ${pt.color}`,
              }}
            />
          ))}

          <style>{`
            @keyframes ss-bounce {
              from { transform: translateY(0) scale(1); }
              to { transform: translateY(-2px) scale(1.02, 0.98); }
            }
            @keyframes ss-shake {
              0%,100% { transform: translate(0,0); }
              20% { transform: translate(-6px, 3px); }
              40% { transform: translate(5px, -3px); }
              60% { transform: translate(-4px, 2px); }
              80% { transform: translate(3px, -1px); }
            }
          `}</style>
        </div>
      </div>

      {status === "paused" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-violet-deep/40 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[2rem] bg-white/95 p-8 text-center shadow-glow">
            <h2 className="text-2xl font-bold text-gradient">Paused</h2>
            <button
              type="button"
              onClick={() => setStatus("playing")}
              className="mt-6 rounded-full bg-button-grad px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {(status === "won" || status === "lost") && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-violet-deep/40 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[2rem] bg-white/95 p-8 text-center shadow-glow">
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 to-violet-500 text-4xl shadow-glow">
              {status === "won" ? "💜" : "🍫"}
            </div>
            <h2 className="text-3xl font-bold text-gradient">
              {status === "won" ? "Sweet Spiral Cleared 💜" : "Oops — Chocolate!"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Score: <span className="font-bold text-violet-deep">{score}</span> ·
              Stars: <span className="font-bold text-violet-deep">{stars}/{totalStars}</span>
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
                Return to Adventure Map
              </button>
              {status === "lost" && (
                <Link
                  to="/map"
                  className="hidden"
                  aria-hidden
                >map</Link>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PlatformRing({ platform, rotation }: { platform: Platform; rotation: number }) {
  const palette = DESSERT_PALETTES[platform.style];

  // Render slices around a cylinder viewed from the front
  const nodes = [];
  for (let i = 0; i < SLICES; i++) {
    const a = i * SLICE_ANGLE + rotation;
    const cosA = Math.cos(a);
    if (cosA < -0.15) continue; // back-facing
    const x = Math.sin(a) * RING_RADIUS;
    const scale = Math.max(0.18, cosA);
    const w = SLICE_ARC_WIDTH * scale;
    const h = RING_HEIGHT;
    const t = platform.slices[i];
    if (t === "gap") continue;
    const bg = t === "safe" ? palette.safe : t === "dissolving" ? palette.dissolving : palette.forbidden;
    const isForbidden = t === "forbidden";
    const isDissolving = t === "dissolving";
    nodes.push(
      <div
        key={i}
        className="absolute"
        style={{
          left: CENTER_X + x - w / 2,
          top: 0,
          width: w,
          height: h,
          background: bg,
          borderRadius: 6,
          zIndex: Math.round((cosA + 1) * 100),
          boxShadow: isForbidden
            ? "0 4px 12px rgba(60,30,10,0.55), inset 0 1px 0 rgba(255,255,255,0.15)"
            : "0 4px 12px rgba(120,60,180,0.35), inset 0 1px 0 rgba(255,255,255,0.5)",
          opacity: 0.35 + 0.65 * scale,
          transition: "opacity 40ms linear",
        }}
      >
        {isDissolving && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-md pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0 3px, transparent 3px 7px)",
              opacity: 0.6,
            }}
          />
        )}
      </div>,
    );
  }

  // Star on top of the ring (if any & visible)
  let starNode: React.ReactNode = null;
  if (platform.star !== null && !platform.starTaken) {
    const a = platform.star * SLICE_ANGLE + rotation;
    const cosA = Math.cos(a);
    if (cosA > -0.05) {
      const x = Math.sin(a) * RING_RADIUS;
      const scale = Math.max(0.3, cosA);
      starNode = (
        <div
          className="absolute"
          style={{
            left: CENTER_X + x - 10 * scale,
            top: -22 * scale,
            width: 20 * scale,
            height: 20 * scale,
            zIndex: 500,
            filter: `drop-shadow(0 0 6px rgba(255,220,120,${0.6 * scale}))`,
            transform: `rotate(${(rotation * 40) % 360}deg)`,
          }}
        >
          <div
            style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #fff8c8, #ffd166 60%, #f0a020)",
              opacity: 0.4 + 0.6 * scale,
            }}
          />
        </div>
      );
    }
  }

  return (
    <div
      className="absolute left-0 w-full"
      style={{ top: platform.y, height: RING_HEIGHT }}
    >
      {/* Base ellipse (ring outline) */}
      <div
        aria-hidden
        className="absolute rounded-[50%]"
        style={{
          left: CENTER_X - RING_RADIUS,
          top: RING_HEIGHT - 6,
          width: RING_RADIUS * 2,
          height: 12,
          background: `radial-gradient(ellipse at center, ${palette.ring}55, transparent 70%)`,
        }}
      />
      {nodes}
      {starNode}
    </div>
  );
}
