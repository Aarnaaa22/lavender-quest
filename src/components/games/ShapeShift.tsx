import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

type ShapeType = "circle" | "square" | "triangle";

type Gate = {
  id: number;
  shape: ShapeType;
  x: number;
  y: number;
  hit: boolean;
};

type Particle = {
  id: number;
  left: number;
  top: number;
  size: number;
  life: number;
  color: string;
  xVel: number;
  yVel: number;
};

const SHAPES: ShapeType[] = ["circle", "square", "triangle"];
const SHAPE_LABELS: Record<ShapeType, string> = {
  circle: "CIRCLE",
  square: "SQUARE",
  triangle: "TRIANGLE",
};

const TARGET_SCORE = 20;
const RUN_TIME = 30;
const SPAWN_INTERVAL = 1400;
const GATE_SPEED = 0.08; // percent per ms

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function ShapeShift({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [currentShape, setCurrentShape] = useState<ShapeType>("circle");
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gates, setGates] = useState<Gate[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [pulse, setPulse] = useState(false);
  const [shake, setShake] = useState(false);

  const nextGateId = useRef(1);
  const frameRef = useRef<number | null>(null);
  const spawnRef = useRef<number | null>(null);
  const lastTimestamp = useRef<number>(0);
  const startTime = useRef<number>(0);

  const shapeClass = `shape-shift-player ${currentShape}`;

  const createGate = useCallback(() => {
    setGates((prev) => [
      ...prev,
      {
        id: nextGateId.current++,
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        x: 25 + Math.random() * 50,
        y: 102,
        hit: false,
      },
    ]);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, color: string) => {
    setParticles((prev) => [
      ...prev,
      ...Array.from({ length: 8 }).map(() => ({
        id: Date.now() + Math.random(),
        left: x,
        top: y,
        size: randomBetween(7, 16),
        life: 1,
        color,
        xVel: randomBetween(-0.9, 0.9),
        yVel: randomBetween(-1.6, -0.6),
      })),
    ]);
  }, []);

  const handleShapeChange = useCallback((shape: ShapeType) => {
    setCurrentShape(shape);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 140);
  }, []);

  const setPlayerShape = useCallback(
    (key: string) => {
      if (key === "1") handleShapeChange("circle");
      if (key === "2") handleShapeChange("square");
      if (key === "3") handleShapeChange("triangle");
    },
    [handleShapeChange],
  );

  const endRun = useCallback(
    (result: "won" | "lost") => {
      if (status !== "playing") return;
      setStatus(result);
      if (result === "won") onWin();
    },
    [onWin, status],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      setPlayerShape(event.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setPlayerShape]);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const delta = timestamp - lastTimestamp.current;
      const runTime = timestamp - startTime.current;
      lastTimestamp.current = timestamp;

      setElapsed(Math.min(RUN_TIME, runTime / 1000));
      setParticles((prev) =>
        prev
          .map((p) => ({ ...p, left: p.left + p.xVel * delta * 0.05, top: p.top + p.yVel * delta * 0.05, life: p.life - delta / 900 }))
          .filter((p) => p.life > 0),
      );

      setGates((prev) => {
        const next = prev
          .map((gate) => ({ ...gate, y: gate.y - GATE_SPEED * delta }))
          .filter((gate) => gate.y > -12);

        next.forEach((gate) => {
          if (gate.hit) return;
          if (gate.y <= 14) {
            gate.hit = true;
            if (gate.shape === currentShape) {
              setScore((s) => s + 1);
              setCombo((c) => c + 1);
              setPulse(true);
              spawnParticles(gate.x, 15, gate.shape === "triangle" ? "#ffd6fa" : gate.shape === "square" ? "#c8f4ff" : "#fff1a8");
              window.setTimeout(() => setPulse(false), 220);
            } else {
              setLives((l) => Math.max(0, l - 1));
              setCombo(0);
              setShake(true);
              window.setTimeout(() => setShake(false), 240);
            }
          }
        });

        return next;
      });

      if (score >= TARGET_SCORE || runTime >= RUN_TIME * 1000) {
        if (lives > 0 && status === "playing") {
          endRun("won");
        }
      }

      if (lives <= 0 && status === "playing") {
        endRun("lost");
      }

      frameRef.current = window.requestAnimationFrame(animate);
    };

    frameRef.current = window.requestAnimationFrame(animate);
    spawnRef.current = window.setInterval(createGate, SPAWN_INTERVAL);
    createGate();

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      if (spawnRef.current) window.clearInterval(spawnRef.current);
    };
  }, [createGate, currentShape, endRun, lives, score, spawnParticles, status]);

  useEffect(() => {
    if (score >= TARGET_SCORE && status === "playing") {
      endRun("won");
    }
  }, [endRun, score, status]);

  const resultMessage = status === "won" ? "Perfect Flow 💜" : "Try Again";
  const showWin = status !== "playing";

  const comboGlow = combo >= 3 ? "shadow-glow" : "";

  return (
    <main className={`relative min-h-screen overflow-hidden shape-shift-bg ${shake ? "shape-shift-shake" : ""}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 16 }).map((_, idx) => (
          <span
            key={idx}
            className="shape-shift-star"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 90}%`,
              width: `${4 + Math.random() * 6}px`,
              height: `${4 + Math.random() * 6}px`,
              animationDelay: `${Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      <header className="relative z-20 flex flex-col gap-3 px-4 py-5 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/map" className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft">
          ← Map
        </Link>

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white">
          <div className="rounded-full glass px-4 py-2 text-violet-deep shadow-soft">
            <span className="font-semibold">Lives</span> <span className="ml-2">{"❤️".repeat(lives)}{lives === 0 ? "💔" : ""}</span>
          </div>
          <div className="rounded-full glass px-4 py-2 text-violet-deep shadow-soft">
            <span className="font-semibold">Score</span> <span className="ml-2 tabular-nums">{score}</span>
          </div>
          <div className={`rounded-full glass px-4 py-2 text-violet-deep shadow-soft ${combo >= 3 ? "bg-violet-200/10 text-white" : ""}`}>
            <span className="font-semibold">Combo</span> <span className="ml-2 tabular-nums">{combo}</span>
          </div>
        </div>
      </header>

      <section className="relative z-20 mx-auto max-w-5xl px-4 pb-8 sm:px-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_0_120px_rgba(150,100,255,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-violet-200/70">Shape Shift</p>
              <h1 className="mt-2 text-3xl font-bold text-white">Keep the flow. Match the gate.</h1>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {SHAPES.map((shape, index) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => handleShapeChange(shape)}
                  className={`rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold transition ${currentShape === shape ? "bg-violet-400/20 text-white shadow-glow" : "bg-white/5 text-violet-100 hover:bg-white/10"}`}
                >
                  <span className="block text-[1.05rem]">{index + 1}</span>
                  <span className="block text-xs uppercase tracking-[0.2em]">{SHAPE_LABELS[shape]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-violet-950/70 px-4 py-3 text-white shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.3em] text-violet-300/70">Goal</p>
              <p className="mt-2 text-sm">Survive 30 seconds or reach {TARGET_SCORE} correct matches.</p>
            </div>
            <div className="rounded-3xl bg-violet-950/70 px-4 py-3 text-white shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.3em] text-violet-300/70">Current Shape</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-white/10 px-3 py-2 text-sm text-white shadow-glow">
                <span className="size-8 grid place-items-center rounded-full bg-violet-500/20 p-2 text-lg">{currentShape === "circle" ? "○" : currentShape === "square" ? "◼" : "△"}</span>
                <span className="font-semibold uppercase tracking-[0.15em]">{SHAPE_LABELS[currentShape]}</span>
              </div>
            </div>
            <div className="rounded-3xl bg-violet-950/70 px-4 py-3 text-white shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.3em] text-violet-300/70">Tip</p>
              <p className="mt-2 text-sm">Switch shapes before gates arrive. Fast reactions keep the combo glowing.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <div className="shape-shift-arena rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur-xl overflow-hidden">
          <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-violet-400/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-violet-100 shadow-soft">
            Keep moving forward. Your shape is the key.
          </div>

          <div className="relative mx-auto mt-8 h-[420px] max-w-4xl">
            {gates.map((gate) => (
              <div
                key={gate.id}
                className={`shape-shift-gate ${gate.shape} ${gate.hit ? "shape-shift-gate-hit" : ""}`}
                style={{ left: `${gate.x}%`, top: `${gate.y}%` }}
              >
                <span className="shape-shift-gate-label">{SHAPE_LABELS[gate.shape]}</span>
              </div>
            ))}

            <div className="shape-shift-player-container">
              <div className={`${shapeClass} ${pulse ? "shape-shift-player-pulse" : ""}`}>
                <span className="shape-shift-player-label">{SHAPE_LABELS[currentShape]}</span>
              </div>
            </div>

            {particles.map((particle) => (
              <span
                key={particle.id}
                className="shape-shift-particle"
                style={{
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  opacity: particle.life,
                  background: particle.color,
                  transform: `translate(-50%, -50%) rotate(${particle.id % 360}deg)`,
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {showWin && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-violet-950/70 px-4 py-6 backdrop-blur-lg">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#1d0636]/95 p-7 text-center shadow-[0_0_80px_rgba(130,58,255,0.35)]">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-500 text-4xl text-white shadow-glow">
              {status === "won" ? "💜" : "⚡"}
            </div>
            <h2 className="text-3xl font-bold text-white">{resultMessage}</h2>
            <p className="mt-3 text-sm text-violet-200/80">
              {status === "won"
                ? "You kept the flow and matched the gates."
                : "Shape mismatch ended the run. Try again and keep the combo alive."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
              >
                Replay
              </button>
              <button
                type="button"
                onClick={onReturn}
                className="rounded-full border border-violet-300/30 bg-white/10 px-5 py-3 text-sm font-semibold text-violet-100 shadow-soft transition hover:bg-white/15"
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
