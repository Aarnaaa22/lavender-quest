import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

const CONFETTI_COLORS = [
  "#d8b4fe", "#c4b5fd", "#f0abfc", "#f9a8d4",
  "#a78bfa", "#e9d5ff", "#fbcfe8", "#ffffff", "#fde68a",
];

type Piece = {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number; rot: number; vr: number;
  color: string; shape: 0 | 1 | 2; // rect | circle | ribbon
  wobble: number; wobbleSpeed: number;
};

/** Canvas-based confetti burst + continuous rain. */
function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const pieces: Piece[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (x: number, y: number, burst: boolean) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = burst ? 6 + Math.random() * 10 : 0;
      pieces.push({
        x, y,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
        vx: burst ? Math.cos(angle) * speed : (Math.random() - 0.5) * 2,
        vy: burst ? Math.sin(angle) * speed - 4 : 1 + Math.random() * 2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        shape: (Math.floor(Math.random() * 3)) as 0 | 1 | 2,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.08,
      });
    };

    // Opening bursts from both bottom corners + center
    for (let i = 0; i < 90; i++) {
      spawn(canvas.width * 0.15, canvas.height, true);
      spawn(canvas.width * 0.85, canvas.height, true);
      if (i % 3 === 0) spawn(canvas.width / 2, canvas.height * 0.4, true);
    }

    // Gentle ongoing rain
    const rain = window.setInterval(() => {
      for (let i = 0; i < 4; i++) spawn(Math.random() * canvas.width, -20, false);
    }, 180);

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.vy += 0.12; // gravity
        p.vx *= 0.99;
        p.vy *= 0.995;
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 1.2;
        p.y += p.vy;
        p.rot += p.vr;

        if (p.y > canvas.height + 30) {
          pieces.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + Math.abs(Math.sin(p.wobble)) * 0.6));
        } else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -1.5, p.w, 3);
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearInterval(rain);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}

const BADGES = [
  { emoji: "🫧", name: "Bubble Beach" },
  { emoji: "🌸", name: "Petal Meadow" },
  { emoji: "🦋", name: "Butterfly Net" },
  { emoji: "🍇", name: "Berry Rush" },
  { emoji: "🌸", name: "Lotus Maze" },
  { emoji: "💜", name: "Tap the Odd One" },
  { emoji: "🐚", name: "Shell Garland" },
  { emoji: "🧁", name: "Balance Stack" },
  { emoji: "🎁", name: "Hidden Haven" },
  { emoji: "💜", name: "Sweet Spiral" },
];

export function Celebration({ credits }: { credits: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 50);
    return () => window.clearTimeout(t);
  }, []);

  const floating = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 7 + Math.random() * 7,
        size: 16 + Math.random() * 22,
        emoji: ["💜", "✨", "🌙", "⭐", "🦋", "🌸"][i % 6],
      })),
    [],
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_transparent_50%),linear-gradient(160deg,_#2e1065_0%,_#7c3aed_55%,_#d946ef_100%)]">
      <ConfettiCanvas />

      {/* Floating dreamy emoji */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
        {floating.map((f) => (
          <span
            key={f.id}
            className="absolute animate-float-slow"
            style={{
              left: `${f.left}%`,
              top: "100%",
              fontSize: f.size,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.duration}s`,
            }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      <div
        className={`relative z-[60] mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-16 text-center transition-all duration-700 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        {/* Trophy */}
        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-amber-300/30 blur-2xl animate-pulse" />
          <div className="relative flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-300 to-yellow-400 text-6xl shadow-[0_20px_60px_-10px_rgba(251,191,36,0.7)] animate-float">
            🏆
          </div>
        </div>

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.4em] text-violet-200">
          Lavender Adventure
        </p>
        <h1 className="mt-3 text-4xl sm:text-6xl font-extrabold text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.35)]">
          Congratulations! 🎉
        </h1>
        <p className="mt-4 max-w-md text-base sm:text-lg font-medium text-violet-100">
          You completed all 10 levels and unlocked the moonlit treasure. The island of Lilac celebrates you! 💜
        </p>

        {/* Stats */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <div className="rounded-2xl bg-white/15 px-6 py-4 backdrop-blur-md border border-white/25">
            <p className="text-2xl font-extrabold text-white">10/10</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">Levels</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-6 py-4 backdrop-blur-md border border-white/25">
            <p className="text-2xl font-extrabold text-white">{credits}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">Credits left</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-6 py-4 backdrop-blur-md border border-white/25">
            <p className="text-2xl font-extrabold text-white">🌙</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">Treasure found</p>
          </div>
        </div>

        {/* Level badges */}
        <div className="mt-8 flex max-w-md flex-wrap items-center justify-center gap-2">
          {BADGES.map((b, i) => (
            <span
              key={i}
              title={b.name}
              className="flex size-11 items-center justify-center rounded-full bg-white/15 border border-white/25 text-xl backdrop-blur-md animate-scale-in"
              style={{ animationDelay: `${0.4 + i * 0.1}s`, animationFillMode: "backwards" }}
            >
              {b.emoji}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/map"
            className="rounded-full bg-white px-8 py-3.5 text-sm font-bold text-violet-700 shadow-[0_10px_30px_-8px_rgba(255,255,255,0.6)] transition-transform hover:scale-105 active:scale-95"
          >
            🗺️ Return to the map
          </Link>
          <Link
            to="/"
            className="rounded-full bg-white/15 px-8 py-3.5 text-sm font-bold text-white border border-white/30 backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
          >
            🏠 Back to start
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Celebration;
