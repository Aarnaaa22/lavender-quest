import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type GarlandType = "shell" | "charm";
type GarlandItem = {
  id: string;
  icon: string;
  label: string;
  hue: number;
  type: GarlandType;
};

type GarlandInstance = GarlandItem & { instanceId: string };
type DragState = {
  item: GarlandInstance;
  x: number;
  y: number;
};

const GARLAND_ITEMS: GarlandItem[] = [
  { id: "shell-ivory", icon: "🐚", label: "Ivory Shell", hue: 42, type: "shell" },
  { id: "shell-amethyst", icon: "🦪", label: "Amethyst Shell", hue: 292, type: "shell" },
  { id: "shell-teal", icon: "🪸", label: "Teal Shell", hue: 176, type: "shell" },
  { id: "shell-petal", icon: "🐚", label: "Petal Shell", hue: 329, type: "shell" },
  { id: "charm-starfish", icon: "⭐", label: "Starfish Charm", hue: 340, type: "charm" },
  { id: "charm-sparkle", icon: "🌟", label: "Sparkle Charm", hue: 320, type: "charm" },
  { id: "charm-lavender", icon: "🌺", label: "Lavender Charm", hue: 305, type: "charm" },
  { id: "charm-breeze", icon: "🏖️", label: "Beach Breeze Charm", hue: 260, type: "charm" },
];

const SHELL_ITEMS = GARLAND_ITEMS.filter((item) => item.type === "shell");
const CHARM_ITEMS = GARLAND_ITEMS.filter((item) => item.type === "charm");
const SLOT_MIN = 8;
const SLOT_MAX = 10;
const TIME_LIMIT = 22;
const WRONG_PENALTY = 4;

function randomBetween(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function buildPalette() {
  return GARLAND_ITEMS.flatMap((item) =>
    [0, 1, 2].map((index) => ({ ...item, instanceId: `${item.id}-${index}` })),
  ).sort(() => Math.random() - 0.5);
}

function pickGarlandPattern() {
  const length = randomBetween(SLOT_MIN, SLOT_MAX);
  const pattern: string[] = [];

  for (let i = 0; i < length; i += 1) {
    const isShellPosition = i === 0 || i === length - 1 || i % 2 === 0;
    const pool = isShellPosition ? SHELL_ITEMS : CHARM_ITEMS;
    const lastItem = pattern[i - 1];
    const secondLastItem = pattern[i - 2];
    const options = pool.filter((item) => item.id !== lastItem || item.id !== secondLastItem);
    const choice = options.length ? options[Math.floor(Math.random() * options.length)] : pool[Math.floor(Math.random() * pool.length)];
    pattern.push(choice.id);
  }

  if (pattern.filter((id) => CHARM_ITEMS.some((item) => item.id === id)).length < 2) {
    pattern[1] = CHARM_ITEMS[Math.floor(Math.random() * CHARM_ITEMS.length)].id;
  }

  if (pattern.filter((id) => SHELL_ITEMS.some((item) => item.id === id)).length < 4) {
    const extraShell = SHELL_ITEMS[Math.floor(Math.random() * SHELL_ITEMS.length)].id;
    pattern[randomBetween(0, length - 1)] = extraShell;
  }

  return pattern;
}

function getItemById(id: string) {
  return GARLAND_ITEMS.find((item) => item.id === id)!;
}

export default function ShellGarland({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [pattern, setPattern] = useState<string[]>(() => pickGarlandPattern());
  const [placed, setPlaced] = useState<Array<string | null>>(() => Array(pattern.length).fill(null));
  const [availableItems, setAvailableItems] = useState<GarlandInstance[]>(() => buildPalette());
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [wrongSlot, setWrongSlot] = useState<number | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const slotRefs = useRef<Array<HTMLDivElement | null>>([]);
  const completedRef = useRef(false);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const placeItem = useCallback(
    (slotIndex: number, item: GarlandInstance) => {
      if (placed[slotIndex] !== null) {
        setWrongSlot(slotIndex);
        setTimeLeft((current) => Math.max(0, current - WRONG_PENALTY));
        window.setTimeout(() => setWrongSlot(null), 260);
        return;
      }

      if (pattern[slotIndex] !== item.id) {
        setWrongSlot(slotIndex);
        setTimeLeft((current) => Math.max(0, current - WRONG_PENALTY));
        window.setTimeout(() => setWrongSlot(null), 260);
        return;
      }

      setPlaced((previous) => {
        const next = [...previous];
        next[slotIndex] = item.id;
        return next;
      });
      setAvailableItems((items) => items.filter((current) => current.instanceId !== item.instanceId));
    },
    [pattern, placed],
  );

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!dragStateRef.current) return;
    event.preventDefault();
    setDragState((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : current));
  }, []);

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current) return;

      const dropIndex = slotRefs.current.findIndex((slot) => {
        if (!slot) return false;
        const rect = slot.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      });

      if (dropIndex >= 0) {
        placeItem(dropIndex, current.item);
      }

      setDragState(null);
    },
    [placeItem],
  );

  useEffect(() => {
    if (!dragState) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragState, handlePointerMove, handlePointerUp]);

  const startDrag = useCallback((item: GarlandInstance, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragState({ item, x: event.clientX, y: event.clientY });
    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setStatus("lost");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== "playing" || completedRef.current) return;
    if (placed.every((value, index) => value === pattern[index] && value !== null)) {
      completedRef.current = true;
      setStatus("won");
      onWin();
    }
  }, [onWin, pattern, placed, status]);

  useEffect(() => {
    if (status === "lost") {
      setShowRetry(true);
    }
  }, [status]);

  const restart = useCallback(() => {
    const nextPattern = pickGarlandPattern();
    setPattern(nextPattern);
    setPlaced(Array(nextPattern.length).fill(null));
    setAvailableItems(buildPalette());
    setTimeLeft(TIME_LIMIT);
    setStatus("playing");
    completedRef.current = false;
    setWrongSlot(null);
    setShowRetry(false);
  }, []);

  const targetItems = useMemo(() => pattern.map(getItemById), [pattern]);
  const correctCount = placed.filter((value, index) => value !== null && value === pattern[index]).length;
  const slotCount = pattern.length;

  return (
    <main className="relative min-h-screen overflow-hidden shell-garland-bg select-none">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.28),_transparent_38%),radial-gradient(circle_at_80%_10%,_rgba(182,147,255,0.18),_transparent_38%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.18),_rgba(255,255,255,0))]" />

      <header className="relative z-20 mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/map"
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
        >
          ← Map
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="rounded-full glass px-4 py-2 text-violet-deep shadow-soft">
            <span className="text-xs uppercase tracking-[0.32em] text-violet-500">Timer</span>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${timeLeft <= 8 ? "text-destructive" : "text-violet-deep"}`}>{timeLeft}s</div>
          </div>
          <div className="rounded-full glass px-4 py-2 text-violet-deep shadow-soft">
            <span className="text-xs uppercase tracking-[0.32em] text-violet-500">Correct</span>
            <div className="mt-1 text-2xl font-semibold text-violet-deep tabular-nums">{correctCount}/{slotCount}</div>
          </div>
        </div>
      </header>

      <section className="relative z-20 mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-glow backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-violet-200/70">Shell Garland</p>
              <h1 className="mt-3 text-4xl font-bold text-white">Perfect Garland 💜</h1>
            </div>
            <p className="max-w-xl text-sm leading-6 text-violet-deep/80">
              Drag shells and charms into the garland slots to match the top pattern exactly. Wrong drops lose a little time.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-violet-950/60 p-4 text-sm text-violet-100 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.34em] text-violet-300/70">Target</p>
              <p className="mt-3">See the pattern above and rebuild it on the garland strip.</p>
            </div>
            <div className="rounded-3xl bg-violet-950/60 p-4 text-sm text-violet-100 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.34em] text-violet-300/70">Drag</p>
              <p className="mt-3">Drag any shell or charm from the palette into an empty slot.</p>
            </div>
            <div className="rounded-3xl bg-violet-950/60 p-4 text-sm text-violet-100 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.34em] text-violet-300/70">Glow</p>
              <p className="mt-3">Correct slots glow softly. Wrong drops reject with a shake.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 pb-10">
        <div className="shell-garland-card">
          <div className="mb-4 text-xs uppercase tracking-[0.32em] text-violet-200/70">Pattern to copy</div>
          <div className="shell-garland-target">{targetItems.map((item, index) => (
            <div key={`${item.id}-${index}`} className="shell-garland-piece" style={{ color: `hsl(${item.hue} 90% 80%)` }}>
              {item.icon}
            </div>
          ))}</div>
        </div>
      </section>

      <section className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 pb-10">
        <div className="shell-garland-card shell-garland-board">
          <div className="relative mb-6 flex items-center justify-center">
            <div className="shell-string" aria-hidden />
            <div className="absolute inset-x-0 top-1/2 mx-auto h-px w-full max-w-3xl bg-violet-300/20 blur-sm" />
            <div className="shell-garland-player">
              {placed.map((placedId, index) => {
                const placedItem = placedId ? getItemById(placedId) : null;
                const isCorrect = placedId !== null && placedId === pattern[index];
                return (
                  <div
                    key={`slot-${index}`}
                    ref={(el) => (slotRefs.current[index] = el)}
                    className={`garland-slot ${placedItem ? "filled" : "empty"} ${isCorrect ? "correct-slot" : ""} ${wrongSlot === index ? "slot-reject" : ""}`}
                  >
                    {placedItem ? (
                      <span className="garland-icon" style={{ color: `hsl(${placedItem.hue} 90% 80%)` }}>
                        {placedItem.icon}
                      </span>
                    ) : (
                      <span className="garland-hint">+</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-violet-950/60 p-4 text-sm text-violet-100 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.34em] text-violet-300/70">Garland slots</p>
              <p className="mt-3">Fill each slot in order from left to right to match the pattern.</p>
            </div>
            <div className="rounded-3xl bg-violet-950/60 p-4 text-sm text-violet-100 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.34em] text-violet-300/70">Match rate</p>
              <p className="mt-3">Correct slots are highlighted as soon as they land.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 pb-24">
        <div className="shell-garland-card">
          <div className="mb-4 text-xs uppercase tracking-[0.32em] text-violet-200/70">Drag from the palette</div>
          <div className="shell-palette">
            {availableItems.map((item) => (
              <button
                key={item.instanceId}
                type="button"
                onPointerDown={(event) => startDrag(item, event)}
                className="shell-palette-item"
                style={{ background: `linear-gradient(180deg, hsla(${item.hue}, 85%, 85%, 0.95), hsla(${item.hue}, 85%, 70%, 0.82))`, color: `hsl(${item.hue} 38% 17%)` }}
              >
                <span className="text-4xl">{item.icon}</span>
                <span className="sr-only">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {dragState && (
        <div
          className="shell-drag-ghost"
          style={{ left: dragState.x, top: dragState.y }}
        >
          {dragState.item.icon}
        </div>
      )}

      {status !== "playing" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-violet-deep/40 px-4 py-6 backdrop-blur-lg">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#1f0b33]/95 p-8 text-center shadow-[0_0_80px_rgba(140,80,255,0.32)]">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-500 text-4xl text-white shadow-glow">💜</div>
            <h2 className="text-3xl font-bold text-white">
              {status === "won" ? "Perfect Garland 💜" : "Try Again"}
            </h2>
            <p className="mt-3 text-sm text-violet-200/80">
              {status === "won"
                ? `You recreated the pattern with ${correctCount}/${slotCount} perfect placements.`
                : "The lavender tide has run out — rebuild the garland and try again."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {status === "lost" ? (
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-full bg-button-grad px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-105"
                >
                  Retry
                </button>
              ) : null}
              <button
                type="button"
                onClick={onReturn}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-violet-deep shadow-soft transition hover:brightness-95"
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
