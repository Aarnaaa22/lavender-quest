export type Progress = {
  currentLevel: number;
  completed: number[];
};

const KEY = "lavender-adventure-progress";
const DEFAULT: Progress = { currentLevel: 1, completed: [] };

export function loadProgress(): Progress {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      currentLevel: Number(parsed.currentLevel) || 1,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
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
  const completed = Array.from(new Set([...cur.completed, levelId])).sort((a, b) => a - b);
  const currentLevel = Math.min(totalLevels, Math.max(cur.currentLevel, levelId + 1));
  const next = { currentLevel, completed };
  saveProgress(next);
  return next;
}

export function resetProgress(): Progress {
  saveProgress(DEFAULT);
  return DEFAULT;
}
