export type Progress = {
  currentLevel: number;
  completed: number[];
  credits: number;
};

const KEY = "lavender-adventure-progress";
const DEFAULT: Progress = { currentLevel: 1, completed: [], credits: 5 };

function sanitizeProgress(value: Partial<Progress> | null | undefined): Progress {
  return {
    currentLevel: Number(value?.currentLevel) || 1,
    completed: Array.isArray(value?.completed) ? value.completed : [],
    credits: Math.max(0, Number(value?.credits) || DEFAULT.credits),
  };
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return sanitizeProgress(parsed);
  } catch {
    return DEFAULT;
  }
}

export function saveProgress(p: Progress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(sanitizeProgress(p)));
}

export function completeLevel(levelId: number, totalLevels: number): Progress {
  const cur = loadProgress();
  const completed = Array.from(new Set([...cur.completed, levelId])).sort((a, b) => a - b);
  const currentLevel = Math.min(totalLevels, Math.max(cur.currentLevel, levelId + 1));
  const credits = Math.max(0, cur.credits + 3);
  const next = { currentLevel, completed, credits };
  saveProgress(next);
  return next;
}

export function skipLevel(levelId: number, totalLevels: number): Progress {
  const cur = loadProgress();
  if (cur.credits < 5) return cur;

  const completed = cur.completed.includes(levelId) ? cur.completed : cur.completed;
  const currentLevel = Math.min(totalLevels, Math.max(cur.currentLevel, levelId + 1));
  const credits = Math.max(0, cur.credits - 5);
  const next = { currentLevel, completed, credits };
  saveProgress(next);
  return next;
}

export function resetProgress(): Progress {
  saveProgress(DEFAULT);
  return DEFAULT;
}
