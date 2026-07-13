import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRandomLayout, type ParsedLayout } from "./HiddenHavenLayouts";

const COLS = 24;
const ROWS = 16;
const TILE = 32;
const SPEED = 4.8; // cells per second
const TOTAL_TIME = 60;
const VISION_R = 3.2; // cells radius for fog clearing

type Dir = "up" | "down" | "left" | "right";

interface Sparkle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number; // 1 down to 0
  color: string;
  isGoldenSparkle?: boolean;
}

interface Butterfly {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  phase: number;
}

interface Trail {
  id: number;
  x: number;
  y: number;
  alpha: number;
}

interface Crystal {
  id: string;
  x: number;
  y: number;
}

export default function HiddenHaven({
  levelId,
  onWin,
  onReturn,
}: {
  levelId: number;
  onWin: () => void;
  onReturn: () => void;
}) {
  const [layout, setLayout] = useState<ParsedLayout>(() => getRandomLayout());
  const [chestPos, setChestPos] = useState<{ x: number; y: number }>(() => {
    const lay = getRandomLayout();
    const idx = Math.floor(Math.random() * lay.candidateChests.length);
    return lay.candidateChests[idx] || { x: 22, y: 14 };
  });

  const [crystals, setCrystals] = useState<Crystal[]>([]);
  const [collectedCrystals, setCollectedCrystals] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"playing" | "discovering" | "won" | "lost">("playing");
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [score, setScore] = useState(0);
  const [collectedCount, setCollectedCount] = useState(0);
  const [cutsceneProgress, setCutsceneProgress] = useState(0);
  const [, tick] = useState(0);

  // Gameplay coordinates refs
  const posRef = useRef({ x: 1.5, y: 1.5 });
  const revealedRef = useRef<boolean[][]>([]);

  // Key states
  const keysPressed = useRef<Set<string>>(new Set());
  const activeButtons = useRef<Record<Dir, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  // Particle and entities refs
  const sparklesRef = useRef<Sparkle[]>([]);
  const butterfliesRef = useRef<Butterfly[]>([]);
  const trailRef = useRef<Trail[]>([]);
  const nextParticleId = useRef(0);
  const butterflyTimerRef = useRef(0);

  // Loop refs
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const cutsceneStartTsRef = useRef<number | null>(null);

  // Initialize a new game round
  const initGame = useCallback((lay: ParsedLayout, chest: { x: number; y: number }) => {
    posRef.current = { x: lay.start.x + 0.5, y: lay.start.y + 0.5 };
    
    // Create new revealed grid (all false)
    const rev: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    
    // Auto-reveal start area
    const sx = lay.start.x;
    const sy = lay.start.y;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = sx + dx;
        const ny = sy + dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
          if (Math.hypot(dx, dy) <= 2.2) {
            rev[ny][nx] = true;
          }
        }
      }
    }
    
    revealedRef.current = rev;
    sparklesRef.current = [];
    butterfliesRef.current = [];
    trailRef.current = [];
    butterflyTimerRef.current = 0;
    
    // Set crystals
    const spawned = (() => {
      const coords: Crystal[] = [];
      const walkable: { x: number; y: number }[] = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (
            lay.grid[y][x] === 0 &&
            !(x === lay.start.x && y === lay.start.y) &&
            !(x === chest.x && y === chest.y)
          ) {
            walkable.push({ x, y });
          }
        }
      }
      const shuffled = walkable.sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(5, shuffled.length); i++) {
        coords.push({ ...shuffled[i], id: `crystal-${shuffled[i].x}-${shuffled[i].y}` });
      }
      return coords;
    })();

    setCrystals(spawned);
    setCollectedCrystals(new Set());
    setCollectedCount(0);
    setScore(0);
    setTimeLeft(TOTAL_TIME);
    setStatus("playing");
    setCutsceneProgress(0);
    doneRef.current = false;
    lastTsRef.current = null;
    cutsceneStartTsRef.current = null;
  }, []);

  // Set up layout on load
  useEffect(() => {
    initGame(layout, chestPos);
  }, [layout, chestPos, initGame]);

  // Bounding box collision checking
  // solid cell types: 1 (tree), 2 (water), 6 (lantern), 7 (candy tree), 8 (crystal rock), 9 (house)
  const isSolid = useCallback((cx: number, cy: number) => {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    const cell = layout.grid[cy][cx];
    return cell === 1 || cell === 2 || cell === 6 || cell === 7 || cell === 8 || cell === 9;
  }, [layout]);

  const checkCollision = useCallback((px: number, py: number, r: number) => {
    const minX = Math.max(0, Math.floor(px - r));
    const maxX = Math.min(COLS - 1, Math.floor(px + r));
    const minY = Math.max(0, Math.floor(py - r));
    const maxY = Math.min(ROWS - 1, Math.floor(py + r));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (isSolid(x, y)) {
          const closestX = Math.max(x, Math.min(px, x + 1));
          const closestY = Math.max(y, Math.min(py, y + 1));

          const dx = px - closestX;
          const dy = py - closestY;
          const distSq = dx * dx + dy * dy;

          if (distSq < r * r) {
            return true;
          }
        }
      }
    }
    return false;
  }, [isSolid]);

  // Key event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== "playing") return;
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
        e.preventDefault();
        keysPressed.current.add(key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current.delete(key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [status]);

  // Distance to active chest
  const distanceToChest = useMemo(() => {
    const px = posRef.current.x;
    const py = posRef.current.y;
    const cx = chestPos.x + 0.5;
    const cy = chestPos.y + 0.5;
    return Math.hypot(cx - px, cy - py);
  }, [chestPos, tick]);

  // Proximity factor used to increase brightness and sparkle spawning
  const proximity = useMemo(() => {
    const maxClueDist = 8.5; // distance inside which sparkles and glow increase
    return Math.max(0, 1 - distanceToChest / maxClueDist);
  }, [distanceToChest]);

  // Game Loop
  useEffect(() => {
    if (status === "won" || status === "lost") return;

    const step = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min(0.03, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      // --- DISCOVERING CUTSCENE LOOP ---
      if (status === "discovering") {
        if (!cutsceneStartTsRef.current) cutsceneStartTsRef.current = ts;
        const elapsed = ts - cutsceneStartTsRef.current;
        const duration = 2400; // ms
        const progress = Math.min(1.0, elapsed / duration);
        
        setCutsceneProgress(progress);

        // Generate burst of starlight particles from the chest
        if (progress < 0.8 && Math.random() < 0.25) {
          const speed = 0.5 + Math.random() * 2.2;
          const angle = Math.random() * Math.PI * 2;
          sparklesRef.current.push({
            id: nextParticleId.current++,
            x: chestPos.x + 0.5,
            y: chestPos.y + 0.5,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2.2 + Math.random() * 3.5,
            alpha: 1.0,
            life: 1.0,
            color: "#ffd700",
          });
        }

        // Force fog cells to fade away near the chest
        const cx = chestPos.x;
        const cy = chestPos.y;
        const fadeRadius = Math.ceil(progress * 15);
        for (let dy = -fadeRadius; dy <= fadeRadius; dy++) {
          for (let dx = -fadeRadius; dx <= fadeRadius; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
              if (Math.hypot(dx, dy) <= fadeRadius) {
                revealedRef.current[ny][nx] = true;
              }
            }
          }
        }

        // Update active sparkles
        sparklesRef.current = sparklesRef.current
          .map((s) => ({
            ...s,
            x: s.x + s.vx * dt,
            y: s.y + s.vy * dt,
            life: s.life - 0.015,
            alpha: s.life,
          }))
          .filter((s) => s.life > 0);

        // End of cutscene
        if (progress >= 1.0) {
          setStatus("won");
          doneRef.current = true;
          onWin();
          return;
        }

        tick((t) => (t + 1) & 0xffff);
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      // --- PLAYING STATE LOOP ---

      // 1. Directional controls velocity vector
      let vx = 0;
      let vy = 0;

      if (keysPressed.current.has("arrowleft") || keysPressed.current.has("a") || activeButtons.current.left) vx = -1;
      if (keysPressed.current.has("arrowright") || keysPressed.current.has("d") || activeButtons.current.right) vx = 1;
      if (keysPressed.current.has("arrowup") || keysPressed.current.has("w") || activeButtons.current.up) vy = -1;
      if (keysPressed.current.has("arrowdown") || keysPressed.current.has("s") || activeButtons.current.down) vy = 1;

      // Normalization
      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx /= len;
        vy /= len;
      }

      // 2. Sliding collision physics
      const p = posRef.current;
      const r = 0.28;
      const moveDist = SPEED * dt;

      if (vx !== 0 || vy !== 0) {
        // Try X
        const nextX = p.x + vx * moveDist;
        if (!checkCollision(nextX, p.y, r)) {
          p.x = nextX;
        }
        // Try Y
        const nextY = p.y + vy * moveDist;
        if (!checkCollision(p.x, nextY, r)) {
          p.y = nextY;
        }

        // Add tail trail sparkles
        if (Math.random() < 0.35) {
          trailRef.current.push({
            id: nextParticleId.current++,
            x: p.x,
            y: p.y,
            alpha: 0.8,
          });
        }
      }

      // Snapping limits
      p.x = Math.max(r, Math.min(COLS - r, p.x));
      p.y = Math.max(r, Math.min(ROWS - r, p.y));

      // 3. Clear Fog of War
      const cellX = Math.floor(p.x);
      const cellY = Math.floor(p.y);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = cellX + dx;
          const ny = cellY + dy;
          if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
            const dist = Math.hypot(nx + 0.5 - p.x, ny + 0.5 - p.y);
            if (dist <= VISION_R && !revealedRef.current[ny][nx]) {
              revealedRef.current[ny][nx] = true;
            }
          }
        }
      }

      // 4. Collect Crystals
      crystals.forEach((cry) => {
        if (!collectedCrystals.has(cry.id)) {
          const dist = Math.hypot(p.x - (cry.x + 0.5), p.y - (cry.y + 0.5));
          if (dist < 0.65) {
            setCollectedCrystals((prev) => {
              const next = new Set(prev);
              next.add(cry.id);
              return next;
            });
            setCollectedCount((c) => c + 1);
            setScore((s) => s + 20);

            // Starlight burst
            for (let i = 0; i < 6; i++) {
              const spd = 0.5 + Math.random() * 1.5;
              const ang = Math.random() * Math.PI * 2;
              sparklesRef.current.push({
                id: nextParticleId.current++,
                x: cry.x + 0.5,
                y: cry.y + 0.5,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                size: 2 + Math.random() * 2,
                alpha: 1,
                life: 1,
                color: "#e2b0ff",
              });
            }
          }
        }
      });

      // 5. Check Chest reach (Cutscene trigger)
      const cx = chestPos.x + 0.5;
      const cy = chestPos.y + 0.5;
      const distToChest = Math.hypot(p.x - cx, p.y - cy);
      if (distToChest < 0.65) {
        setStatus("discovering");
        // Spawn win particle burst
        for (let i = 0; i < 40; i++) {
          const spd = 0.8 + Math.random() * 3.5;
          const ang = Math.random() * Math.PI * 2;
          sparklesRef.current.push({
            id: nextParticleId.current++,
            x: cx,
            y: cy,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            size: 2.5 + Math.random() * 4,
            alpha: 1.0,
            life: 1.0,
            color: "#ffd700",
          });
        }
        return;
      }

      // 6. UPDATE ENTITIES AND HINTS

      // A. Golden sparkles in the fog (Hint)
      if (Math.random() < 0.05) {
        const angle = Math.random() * Math.PI * 2;
        // Sparkle spawns relative to chest
        const radius = 1 + Math.random() * 4.5;
        const sx = chestPos.x + 0.5 + Math.cos(angle) * radius;
        const sy = chestPos.y + 0.5 + Math.sin(angle) * radius;
        if (sx >= 0 && sx < COLS && sy >= 0 && sy < ROWS) {
          // Check that cell is unrevealed so sparkle glows inside the fog
          const cellX = Math.floor(sx);
          const cellY = Math.floor(sy);
          if (!revealedRef.current[cellY]?.[cellX]) {
            sparklesRef.current.push({
              id: nextParticleId.current++,
              x: sx,
              y: sy,
              vx: (Math.random() - 0.5) * 0.15,
              vy: (Math.random() - 0.5) * 0.15,
              size: 2.2 + Math.random() * 2.8,
              alpha: 0.9,
              life: 1.0,
              color: "#ffd700",
              isGoldenSparkle: true,
            });
          }
        }
      }

      // B. Golden butterflies indicator (Hint)
      butterflyTimerRef.current += dt;
      if (butterflyTimerRef.current > 7.0) {
        butterflyTimerRef.current = 0;
        // Vector pointing to chest
        const dx = cx - p.x;
        const dy = cy - p.y;
        const len = Math.hypot(dx, dy);
        if (len > 3.0) { // only guide if player is not already on top of it
          const bvx = (dx / len) * 1.5;
          const bvy = (dy / len) * 1.5;
          for (let i = 0; i < 3; i++) {
            butterfliesRef.current.push({
              id: nextParticleId.current++,
              x: p.x + (Math.random() - 0.5) * 0.8,
              y: p.y + (Math.random() - 0.5) * 0.8,
              vx: bvx + (Math.random() - 0.5) * 0.4,
              vy: bvy + (Math.random() - 0.5) * 0.4,
              size: 5.5 + Math.random() * 3.5,
              life: 1.0,
              phase: Math.random() * 20,
            });
          }
        }
      }

      // C. Update butterflies
      butterfliesRef.current = butterfliesRef.current
        .map((b) => {
          // Butterfly leaves a tail of sparkles
          if (Math.random() < 0.22) {
            sparklesRef.current.push({
              id: nextParticleId.current++,
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 0.2,
              vy: 0.1 + Math.random() * 0.3,
              size: 1.2 + Math.random() * 1.5,
              alpha: 0.75,
              life: 0.7,
              color: "#ffe57f",
            });
          }
          return {
            ...b,
            x: b.x + b.vx * dt,
            y: b.y + b.vy * dt,
            life: b.life - 0.008, // fades out after ~4 seconds
            phase: b.phase + 0.35, // flutter phase speed
          };
        })
        .filter((b) => b.life > 0);

      // D. Update general particles
      // Player tail
      trailRef.current = trailRef.current
        .map((t) => ({ ...t, alpha: t.alpha - 0.04 }))
        .filter((t) => t.alpha > 0);

      // Active sparkles decay
      sparklesRef.current = sparklesRef.current
        .map((s) => {
          const decay = s.isGoldenSparkle ? 0.024 : 0.016;
          return {
            ...s,
            x: s.x + s.vx * dt,
            y: s.y + s.vy * dt,
            life: s.life - decay,
            alpha: s.life,
          };
        })
        .filter((s) => s.life > 0);

      // E. Spawn ambient starlight sparkles, scales with proximity to the chest
      const spawnChance = 0.06 + proximity * 0.32;
      if (Math.random() < spawnChance) {
        const revealedCoords: { x: number; y: number }[] = [];
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            if (revealedRef.current[y]?.[x]) {
              revealedCoords.push({ x, y });
            }
          }
        }
        if (revealedCoords.length > 0) {
          const coord = revealedCoords[Math.floor(Math.random() * revealedCoords.length)];
          sparklesRef.current.push({
            id: nextParticleId.current++,
            x: coord.x + Math.random(),
            y: coord.y + Math.random(),
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.3 - Math.random() * 0.5,
            size: 1.2 + Math.random() * 2.2,
            alpha: 0.8,
            life: 1.0,
            color: Math.random() > 0.5 ? "#f5d6f4" : "#e5d9f2",
          });
        }
      }

      tick((t) => (t + 1) & 0xffff);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, layout, chestPos, checkCollision, collectedCrystals, proximity, onWin]);

  // Timer effect
  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!doneRef.current) {
            doneRef.current = true;
            setStatus("lost");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Reset/Restart game
  const handleReset = () => {
    const lay = getRandomLayout();
    const idx = Math.floor(Math.random() * lay.candidateChests.length);
    setLayout(lay);
    setChestPos(lay.candidateChests[idx] || { x: 22, y: 14 });
  };

  // Touch swipe tracking
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || status !== "playing") return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    const thresh = 25;

    if (Math.abs(dx) > thresh || Math.abs(dy) > thresh) {
      const btns = { up: false, down: false, left: false, right: false };
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) btns.right = true;
        else btns.left = true;
      } else {
        if (dy > 0) btns.down = true;
        else btns.up = true;
      }
      activeButtons.current = btns;
    }
  };

  const handleTouchEnd = () => {
    touchStartPos.current = null;
    activeButtons.current = { up: false, down: false, left: false, right: false };
  };

  // Virtual buttons event binder
  const bindButton = (dir: Dir) => {
    const start = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      activeButtons.current[dir] = true;
    };
    const end = () => {
      activeButtons.current[dir] = false;
    };
    return {
      onMouseDown: start,
      onMouseUp: end,
      onMouseLeave: end,
      onTouchStart: start,
      onTouchEnd: end,
    };
  };

  // SVG Viewbox calculations with zoom-in cutscene interpolation
  const viewW = COLS * TILE;
  const viewH = ROWS * TILE;
  const px = posRef.current.x * TILE;
  const py = posRef.current.y * TILE;
  
  const viewBoxString = useMemo(() => {
    if (status === "discovering" || status === "won") {
      const cx = chestPos.x * TILE + TILE / 2;
      const cy = chestPos.y * TILE + TILE / 2;
      // Interpolate zoom: 0% cutsceneProgress -> 100% (zoom is 2.2x, i.e., viewport shrinks to 45% size)
      const currentW = viewW * (1.0 - cutsceneProgress * 0.55);
      const currentH = viewH * (1.0 - cutsceneProgress * 0.55);
      const currentX = (cx - currentW / 2) * cutsceneProgress;
      const currentY = (cy - currentH / 2) * cutsceneProgress;
      return `${currentX} ${currentY} ${currentW} ${currentH}`;
    }
    return `0 0 ${viewW} ${viewH}`;
  }, [status, cutsceneProgress, chestPos.x, chestPos.y, viewW, viewH]);

  // Chest visibility check
  const isChestRevealed = revealedRef.current[chestPos.y]?.[chestPos.x] ?? false;

  // Chest opening lid interpolation or static path toggle
  const isChestOpen = status === "discovering" && cutsceneProgress > 0.45;

  return (
    <main
      className="relative min-h-[92vh] overflow-hidden flex flex-col justify-between"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Starry Particles */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {Array.from({ length: 15 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/70 animate-twinkle"
            style={{
              left: `${(i * 7 + 13) % 100}%`,
              top: `${(i * 11 + 7) % 100}%`,
              width: `${1.5 + ((i * 3) % 3)}px`,
              height: `${1.5 + ((i * 3) % 3)}px`,
              animationDelay: `${(i * 0.7) % 4}s`,
              animationDuration: `${2.5 + ((i * 1.2) % 3)}s`,
              boxShadow: "0 0 6px rgba(255, 255, 255, 0.8)",
            }}
          />
        ))}
      </div>

      {/* 1. Header controls */}
      <header className="relative z-20 flex items-center justify-between gap-3 p-4 select-none">
        <button
          onClick={onReturn}
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-violet-deep hover:scale-105 transition-transform shadow-soft"
        >
          ← Map
        </button>

        {/* Level Title and subtitle clues */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gradient uppercase tracking-wider">Hidden Haven</h2>
          <span className="text-[10px] font-bold text-violet-500/80 uppercase tracking-widest block mt-0.5 animate-pulse">
            {proximity > 0.8 ? "Warm golden light leaks..." : proximity > 0.5 ? "A magical feeling in the air..." : "Wander and look for starlight clues"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full glass px-3 py-2 shadow-soft">
            <span className="text-xs font-semibold text-violet-deep/70">✨ Crystals </span>
            <span className="text-sm font-bold text-violet-deep tabular-nums">{collectedCount}</span>
          </div>
          <div className={`rounded-full glass px-3 py-2 shadow-soft ${timeLeft <= 10 ? "ring-2 ring-rose-400 animate-pulse" : ""}`}>
            <span className="text-xs font-semibold text-violet-deep/70">⏱ </span>
            <span className={`text-sm font-bold tabular-nums ${timeLeft <= 10 ? "text-rose-500" : "text-violet-deep"}`}>
              {timeLeft}s
            </span>
          </div>
        </div>
      </header>

      {/* 2. GAME BOARD */}
      <div className="relative z-10 mx-auto px-4 flex items-center justify-center flex-1 max-w-full">
        <div className="relative rounded-2xl p-2 sm:p-3 bg-white/40 border border-white/60 shadow-glow" style={{ width: "min(96vw, 840px)" }}>
          <div className="relative w-full rounded-xl overflow-hidden bg-[radial-gradient(circle_at_center,_#faf3ff_0%,_#ebd9fc_100%)]" style={{ aspectRatio: `${COLS} / ${ROWS}` }}>
            <svg
              viewBox={viewBoxString}
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="xMidYMid meet"
              style={{ transition: "viewBox 0.5s ease-out" }}
            >
              <defs>
                {/* Gradients */}
                <linearGradient id="ray-grad" x1="50%" y1="100%" x2="50%" y2="0%">
                  <stop offset="0%" stopColor="#ffd700" stopOpacity="0.8" />
                  <stop offset="40%" stopColor="#ffecb3" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </linearGradient>

                <radialGradient id="chest-glow-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffe680" stopOpacity="0.85" />
                  <stop offset="35%" stopColor="#ffd700" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
                </radialGradient>

                <radialGradient id="mush-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fff" stopOpacity="1" />
                  <stop offset="40%" stopColor="#c5b3fa" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#b19ffb" stopOpacity="0" />
                </radialGradient>

                <radialGradient id="fog-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="45%" stopColor="#ebdffc" stopOpacity="1" />
                  <stop offset="85%" stopColor="#ebdffc" stopOpacity="0.94" />
                  <stop offset="100%" stopColor="#dccbfa" stopOpacity="0" />
                </radialGradient>

                <radialGradient id="fairy-halo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="40%" stopColor="#ffd3fd" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#e6a4ff" stopOpacity="0" />
                </radialGradient>

                {/* Filters */}
                <filter id="fairy-glow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="chest-glow-filter">
                  <feGaussianBlur stdDeviation="3.0" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* A. WORLD RENDER LAYERS */}

              {/* 1. Base Ponds & Bridges */}
              {layout.grid.map((row, y) =>
                row.map((cell, x) => {
                  // Bridge
                  if (cell === 3) {
                    return (
                      <g key={`br-${x}-${y}`}>
                        <rect x={x * TILE} y={y * TILE} width={TILE} height={TILE} fill="#d2c5e8" opacity="0.3" />
                        <rect x={x * TILE + 2} y={y * TILE + 4} width={TILE - 4} height={6} fill="#70537a" rx={1.5} />
                        <rect x={x * TILE + 2} y={y * TILE + 13} width={TILE - 4} height={6} fill="#70537a" rx={1.5} />
                        <rect x={x * TILE + 2} y={y * TILE + 22} width={TILE - 4} height={6} fill="#70537a" rx={1.5} />
                        <line x1={x * TILE + 4} y1={y * TILE} x2={x * TILE + 4} y2={y * TILE + TILE} stroke="#543c5c" strokeWidth={1} strokeDasharray="2 2" />
                        <line x1={x * TILE + TILE - 4} y1={y * TILE} x2={x * TILE + TILE - 4} y2={y * TILE + TILE} stroke="#543c5c" strokeWidth={1} strokeDasharray="2 2" />
                      </g>
                    );
                  }
                  // Water
                  if (cell === 2) {
                    return (
                      <g key={`wt-${x}-${y}`}>
                        <rect x={x * TILE} y={y * TILE} width={TILE} height={TILE} fill="#b8c9eb" opacity="0.82" rx={5} />
                        <path d={`M ${x * TILE + 4},${y * TILE + 16} Q ${x * TILE + 16},${y * TILE + 10} ${x * TILE + 28},${y * TILE + 16}`} stroke="#8fa9db" strokeWidth={1.5} fill="none" opacity="0.6" className="water-ripple" />
                      </g>
                    );
                  }
                  return null;
                })
              )}

              {/* 2. Walkable swaying flowers and glowing mushrooms */}
              {layout.grid.map((row, y) =>
                row.map((cell, x) => {
                  // Swaying Flower
                  if (cell === 4) {
                    return (
                      <g key={`fl-${x}-${y}`} transform={`translate(${x * TILE}, ${y * TILE})`}>
                        <g className="flower-sway">
                          <path d="M 16,28 Q 14,20 16,14" stroke="#8cb58c" strokeWidth={1.5} fill="none" />
                          <circle cx="16" cy="14" r="5" fill="#fca8cf" />
                          <circle cx="12" cy="14" r="3.5" fill="#fca8cf" opacity="0.85" />
                          <circle cx="20" cy="14" r="3.5" fill="#fca8cf" opacity="0.85" />
                          <circle cx="16" cy="10" r="3.5" fill="#fca8cf" opacity="0.85" />
                          <circle cx="16" cy="18" r="3.5" fill="#fca8cf" opacity="0.85" />
                          <circle cx="16" cy="14" r="2" fill="#fff" />
                        </g>
                      </g>
                    );
                  }
                  // Glowing Mushroom
                  if (cell === 5) {
                    return (
                      <g key={`mu-${x}-${y}`} transform={`translate(${x * TILE}, ${y * TILE})`}>
                        <g className="mushroom-glow">
                          <path d="M 14,26 Q 16,18 18,26" stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" opacity="0.9" />
                          <path d="M 10,20 Q 16,9 22,20 Z" fill="#b99ffc" />
                          <circle cx="16" cy="15" r="5" fill="url(#mush-glow)" style={{ mixBlendMode: "screen" }} />
                          <circle cx="13" cy="15" r="0.6" fill="#fff" />
                          <circle cx="19" cy="17" r="0.6" fill="#fff" />
                        </g>
                      </g>
                    );
                  }
                  return null;
                })
              )}

              {/* 3. Collectibles (Crystals) */}
              {crystals.map((cry) => {
                if (collectedCrystals.has(cry.id)) return null;
                return (
                  <g key={cry.id} transform={`translate(${cry.x * TILE}, ${cry.y * TILE})`}>
                    <circle cx="16" cy="16" r="12" fill="#ebbeff" opacity="0.25" className="animate-ping" style={{ animationDuration: "2.2s" }} />
                    <polygon
                      points="16,6 23,16 16,26 9,16"
                      fill="#e2b0ff"
                      stroke="#fff"
                      strokeWidth={1.2}
                      className="crystal-float"
                    />
                    <polygon points="16,9 20,16 16,23 12,16" fill="#ffffff" opacity="0.45" />
                  </g>
                );
              })}

              {/* 4. GOLDEN TREASURE CHEST (Goal) */}
              <g>
                {/* 1. Faint Golden Glow emanating (Shines through unrevealed fog as hint!) */}
                <circle
                  cx={chestPos.x * TILE + TILE / 2}
                  cy={chestPos.y * TILE + TILE / 2}
                  r={TILE * (1.6 + proximity * 1.4)}
                  fill="url(#chest-glow-grad)"
                  filter="url(#chest-glow-filter)"
                  opacity={0.35 + proximity * 0.65}
                  className="animate-pulse"
                />

                {/* 2. Actual chest container (Rendered when revealed or during cutscene) */}
                {(isChestRevealed || status === "discovering" || status === "won") && (
                  <g transform={`translate(${chestPos.x * TILE}, ${chestPos.y * TILE})`}>
                    {!isChestOpen ? (
                      /* Closed chest SVG */
                      <g className="animate-float">
                        {/* Chest base */}
                        <rect x="4" y="16" width="24" height="12" fill="#9f85d1" rx="2.5" stroke="#ffe57f" strokeWidth={1.8} />
                        {/* Lid */}
                        <path d="M 4,16 Q 16,5 28,16 Z" fill="#8161bd" stroke="#ffe57f" strokeWidth={1.8} />
                        {/* Lock details */}
                        <rect x="13.5" y="14" width="5" height="5.5" fill="#ffd700" rx="0.5" stroke="#d4af37" strokeWidth={0.5} />
                        <circle cx="16" cy="16.5" r="0.8" fill="#000" />
                        {/* Starlight corners */}
                        <circle cx="6" cy="18" r="1.2" fill="#fff" />
                        <circle cx="26" cy="18" r="1.2" fill="#fff" />
                      </g>
                    ) : (
                      /* Open chest SVG */
                      <g>
                        {/* Light rays ray grad */}
                        <path d="M 16,15 L -6,-15 L 38,-15 Z" fill="url(#ray-grad)" opacity={0.6 + Math.sin(tick() * 0.1) * 0.15} />
                        {/* Chest base */}
                        <rect x="4" y="16" width="24" height="12" fill="#9f85d1" rx="2.5" stroke="#ffe57f" strokeWidth={1.8} />
                        {/* Inside gold treasures core */}
                        <rect x="6" y="14" width="20" height="4.5" fill="#ffe57f" rx="1" />
                        <circle cx="10" cy="15.5" r="1.8" fill="#fff" />
                        <circle cx="16" cy="15.5" r="2.2" fill="#fff" className="animate-ping" style={{ animationDuration: "1.5s" }} />
                        <circle cx="22" cy="15.5" r="1.8" fill="#fff" />
                        {/* Lid open up */}
                        <path d="M 4,12 Q 16,21 28,12 Z" fill="#8161bd" stroke="#ffe57f" strokeWidth={1.8} transform="translate(0, -6.5)" />
                      </g>
                    )}
                  </g>
                )}
              </g>

              {/* 5. SOLID Obstacles (Trees, Houses, Crystals, Lanterns) */}
              {layout.grid.map((row, y) =>
                row.map((cell, x) => {
                  // Standard Tree
                  if (cell === 1) {
                    return (
                      <g key={`tr-${x}-${y}`} transform={`translate(${x * TILE}, ${y * TILE})`}>
                        <path d="M 12,28 L 20,28 L 18,17 L 14,17 Z" fill="#755a82" />
                        <circle cx="16" cy="16" r="11" fill="#ac88cc" opacity="0.9" />
                        <circle cx="12" cy="11" r="9" fill="#c3a7db" opacity="0.9" />
                        <circle cx="20" cy="11" r="9" fill="#c3a7db" opacity="0.9" />
                        <circle cx="16" cy="7" r="8.5" fill="#edd6ff" />
                        <circle cx="13" cy="8" r="0.8" fill="#fff" opacity="0.8" className="animate-pulse" />
                        <circle cx="19" cy="12" r="0.8" fill="#fff" opacity="0.8" className="animate-pulse" style={{ animationDelay: "0.4s" }} />
                      </g>
                    );
                  }
                  // Fairy Lantern
                  if (cell === 6) {
                    return (
                      <g key={`lt-${x}-${y}`} transform={`translate(${x * TILE}, ${y * TILE})`}>
                        <line x1="16" y1="28" x2="16" y2="10" stroke="#5b4869" strokeWidth={2.2} />
                        <path d="M 16,10 L 22,10" stroke="#5b4869" strokeWidth={1.5} />
                        <circle cx="22" cy="14" r="3.5" fill="#fffae0" />
                        <circle cx="22" cy="14" r="12" fill="#fffae0" opacity="0.14" className="animate-pulse" />
                      </g>
                    );
                  }
                  // Candy Tree
                  if (cell === 7) {
                    return (
                      <g key={`ct-${x}-${y}`} transform={`translate(${x * TILE}, ${y * TILE})`}>
                        <rect x="14" y="21" width="4" height="9" fill="#a16843" rx="1.5" />
                        <circle cx="16" cy="12" r="10.5" fill="#ffb3c6" />
                        <path d="M 16,12 C 16,8 20,6 20,12 C 20,18 12,18 12,12 C 12,6 22,4 22,12" stroke="#ff4d6d" strokeWidth={1.8} fill="none" />
                        <circle cx="13" cy="9" r="1.2" fill="#fff" opacity="0.8" />
                        <circle cx="19" cy="15" r="0.8" fill="#fff" opacity="0.8" />
                      </g>
                    );
                  }
                  // Crystal Rock
                  if (cell === 8) {
                    return (
                      <g key={`cr-${x}-${y}`} transform={`translate(${x * TILE}, ${y * TILE})`}>
                        <polygon points="16,29 9,14 16,6 23,14" fill="#d6bdf2" stroke="#b388eb" strokeWidth={1} />
                        <polygon points="16,29 5,19 9,15 13,25" fill="#a06cd5" stroke="#7b2cbf" strokeWidth={0.8} />
                        <polygon points="16,29 27,19 23,15 19,25" fill="#e2cfea" stroke="#fff" strokeWidth={0.8} />
                      </g>
                    );
                  }
                  // Decorative House
                  if (cell === 9) {
                    return (
                      <g key={`hs-${x}-${y}`} transform={`translate(${x * TILE}, ${y * TILE})`}>
                        <rect x="5" y="15" width="22" height="13.5" fill="#fffcf7" rx="2" stroke="#dfd3c3" strokeWidth={1.2} />
                        <rect x="13" y="19" width="6" height="9.5" fill="#a06cd5" rx="1" />
                        <circle cx="14.5" cy="24" r="0.8" fill="#fff" />
                        <path d="M 2,15 L 16,3 L 30,15 Z" fill="#b392ac" stroke="#83677e" strokeWidth={1.2} />
                        <circle cx="16" cy="9" r="1.5" fill="#ffd8d3" />
                      </g>
                    );
                  }
                  return null;
                })
              )}

              {/* 6. Sparkles/Starlight particles */}
              {sparklesRef.current.map((s) => (
                <circle
                  key={s.id}
                  cx={s.x * TILE}
                  cy={s.y * TILE}
                  r={s.size * (s.isGoldenSparkle ? 1 + Math.sin(tick() * 0.15) * 0.2 : 1)}
                  fill={s.color}
                  opacity={s.alpha}
                />
              ))}

              {/* 7. Golden Butterflies indicator */}
              {butterfliesRef.current.map((b) => (
                <g key={b.id} transform={`translate(${b.x * TILE}, ${b.y * TILE})`} opacity={b.life}>
                  {/* Flap wings by scaling X axis */}
                  <g transform={`scale(${0.25 + Math.abs(Math.sin(b.phase)) * 0.75}, 1)`} filter="url(#fairy-glow)">
                    {/* Left wings */}
                    <path d="M 0,0 C -5,-8 -10,-5 -3,-1 Z" fill="#ffd700" />
                    <path d="M 0,0 C -3,5 -7,3 -2,1 Z" fill="#ffca28" opacity="0.8" />
                    {/* Right wings */}
                    <path d="M 0,0 C 5,-8 10,-5 3,-1 Z" fill="#ffd700" />
                    <path d="M 0,0 C 3,5 7,3 2,1 Z" fill="#ffca28" opacity="0.8" />
                  </g>
                  <circle r="1" fill="#fff" />
                </g>
              ))}

              {/* 8. Player Fairy Trail */}
              {trailRef.current.map((t) => (
                <circle
                  key={t.id}
                  cx={t.x * TILE}
                  cy={t.y * TILE}
                  r={TILE * 0.22 * t.alpha}
                  fill="#fbc4ff"
                  opacity={t.alpha * 0.45}
                  filter="url(#fairy-glow)"
                />
              ))}

              {/* 9. PLAYER (Glowing Fairy) */}
              {status !== "discovering" && status !== "won" && (
                <g transform={`translate(${px}, ${py})`} filter="url(#fairy-glow)" className="select-none pointer-events-none">
                  <circle r={TILE * 0.5} fill="url(#fairy-halo)" className="animate-pulse" />
                  <path d="M 0,0 C -6,-12 -12,-8 -4,-2 Z" fill="#ebcfff" opacity="0.85" className="animate-pulse" />
                  <path d="M 0,0 C 6,-12 12,-8 4,-2 Z" fill="#ebcfff" opacity="0.85" className="animate-pulse" />
                  <circle r={TILE * 0.16} fill="#ffffff" />
                  <circle r={TILE * 0.1} fill="#ffcffb" />
                </g>
              )}

              {/* 10. FOG OF WAR (Enchanted Mist Cover) */}
              {status !== "won" && (
                <g id="fog-layer" style={{ opacity: status === "discovering" ? 1 - cutsceneProgress : 1 }}>
                  {revealedRef.current.map((row, y) =>
                    row.map((isRev, x) => {
                      return (
                        <circle
                          key={`fog-${x}-${y}`}
                          cx={x * TILE + TILE / 2}
                          cy={y * TILE + TILE / 2}
                          r={TILE * 1.62} // overlap to ensure mist is a full blanket
                          fill="url(#fog-grad)"
                          className="transition-all duration-[1000ms] ease-out pointer-events-none"
                          style={{
                            opacity: isRev ? 0 : 0.95,
                            transform: isRev ? "scale(0.7) translate(0, -7px)" : "scale(1)",
                            transformOrigin: `${x * TILE + TILE / 2}px ${y * TILE + TILE / 2}px`,
                          }}
                        />
                      );
                    })
                  )}
                </g>
              )}
            </svg>

            {/* Ambient golden glow overlays matching proximity */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                background: "radial-gradient(circle at center, rgba(255, 215, 0, 0.08) 0%, transparent 80%)",
                opacity: proximity,
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. CONTROLS PANEL */}
      <footer className="relative z-20 w-full max-w-md mx-auto px-4 pb-4 mt-2">
        <p className="text-center text-[10px] font-medium text-violet-deep/60 leading-relaxed max-w-xs mx-auto mb-2">
          Controls: <span className="font-semibold text-violet-deep/80">W A S D</span> / <span className="font-semibold text-violet-deep/80">Arrow keys</span> (desktop).<br />
          Hold virtual buttons below or swipe directly on the board (mobile).
        </p>

        {/* On-screen controller for touch screens */}
        <div className="flex justify-center md:hidden">
          <div className="grid grid-cols-3 gap-2 w-32 aspect-square select-none">
            <div />
            <button
              {...bindButton("up")}
              className="rounded-xl glass flex items-center justify-center text-lg font-bold text-violet-deep active:scale-90 shadow-soft"
              aria-label="Up"
            >
              ↑
            </button>
            <div />

            <button
              {...bindButton("left")}
              className="rounded-xl glass flex items-center justify-center text-lg font-bold text-violet-deep active:scale-90 shadow-soft"
              aria-label="Left"
            >
              ←
            </button>
            <div className="flex items-center justify-center text-xs font-semibold text-violet-400">
              🧚
            </div>
            <button
              {...bindButton("right")}
              className="rounded-xl glass flex items-center justify-center text-lg font-bold text-violet-deep active:scale-90 shadow-soft"
              aria-label="Right"
            >
              →
            </button>

            <div />
            <button
              {...bindButton("down")}
              className="rounded-xl glass flex items-center justify-center text-lg font-bold text-violet-deep active:scale-90 shadow-soft"
              aria-label="Down"
            >
              ↓
            </button>
            <div />
          </div>
        </div>
      </footer>

      {/* 4. MODALS (WIN / LOSS) */}
      {(status === "won" || status === "lost") && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-violet-deep/45 backdrop-blur-md animate-[fade-up_0.3s_ease-out]">
          <div className="relative w-full max-w-sm rounded-[2rem] glass p-8 text-center shadow-glow animate-[zoom-in_0.4s_cubic-bezier(0.16,1,0.3,1)]">
            <div className={`mx-auto size-20 rounded-full flex items-center justify-center text-4xl shadow-glow animate-float ${status === "won" ? "bg-button-grad" : "bg-gradient-to-br from-rose-400 to-pink-500"}`}>
              {status === "won" ? "🎁" : "🌫️"}
            </div>

            <h2 className="mt-5 text-2xl font-bold text-gradient">
              {status === "won" ? "✨ Treasure Found! ✨" : "Lost in the Mist"}
            </h2>

            <p className="mt-2 text-xs text-muted-foreground">
              {status === "won"
                ? "You explored the magical forest and uncovered the hidden haven't treasures."
                : "The enchanted mist closed in before you could find the reward."}
            </p>

            <div className="mt-4 py-2 border-y border-violet-100/30 flex justify-around text-xs font-bold text-violet-deep">
              <div>
                <p className="text-violet-deep/60">Time Left</p>
                <p className="text-base tabular-nums mt-0.5">{timeLeft}s</p>
              </div>
              <div className="border-r border-violet-100/30" />
              <div>
                <p className="text-violet-deep/60">Crystals</p>
                <p className="text-base tabular-nums mt-0.5">{collectedCount}</p>
              </div>
              <div className="border-r border-violet-100/30" />
              <div>
                <p className="text-violet-deep/60">Final Score</p>
                <p className="text-base tabular-nums mt-0.5">{score + (status === "won" ? timeLeft * 6 : 0)}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={handleReset}
                className="w-full rounded-full glass py-3 text-sm font-bold text-violet-deep hover:scale-[1.02] active:scale-95 transition-all shadow-soft"
              >
                ↺ Play Again
              </button>
              <button
                onClick={onReturn}
                className="w-full rounded-full bg-button-grad py-3 text-sm font-bold text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-95 transition-all"
              >
                Return to Adventure Map →
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
