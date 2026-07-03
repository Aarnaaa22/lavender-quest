export type Progress = {
  currentLevel: number;
  completed: number[];
  credits: number;
};

const KEY = "lavender-adventure-progress";
export const STARTING_CREDITS = 10;
export const SKIP_COST = 5;
export const COMPLETE_REWARD = 3;

const DEFAULT: Progress = { currentLevel: 1, completed: [], credits: STARTING_CREDITS };

export function loadProgress(): Progress {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      currentLevel: Number(parsed.currentLevel) || 1,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      credits:
        typeof parsed.credits === "number" ? parsed.credits : STARTING_CREDITS,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveProgress(p: Progress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function completeLevel(levelId: number, totalLevels: number): Progress {
  const cur = loadProgress();
  const firstTime = !cur.completed.includes(levelId);
  const completed = Array.from(new Set([...cur.completed, levelId])).sort((a, b) => a - b);
  const currentLevel = Math.min(totalLevels, Math.max(cur.currentLevel, levelId + 1));
  const credits = cur.credits + (firstTime ? COMPLETE_REWARD : 0);
  const next = { currentLevel, completed, credits };
  saveProgress(next);
  return next;
}

export function skipLevel(levelId: number, totalLevels: number): Progress | null {
  const cur = loadProgress();
  if (cur.credits < SKIP_COST) return null;
  if (cur.completed.includes(levelId)) return cur;
  const completed = Array.from(new Set([...cur.completed, levelId])).sort((a, b) => a - b);
  const currentLevel = Math.min(totalLevels, Math.max(cur.currentLevel, levelId + 1));
  const next = { currentLevel, completed, credits: cur.credits - SKIP_COST };
  saveProgress(next);
  return next;
}

export function resetProgress(): Progress {
  saveProgress(DEFAULT);
  return DEFAULT;
}
