import { Link } from "@tanstack/react-router";
import { SkipLevelButton } from "@/components/SkipLevelButton";

export function GameHeader({
  credits,
  title,
  onSkip,
  skipDisabled,
  skipLabel,
  helperText,
}: {
  credits: number;
  title: string;
  onSkip: () => void;
  skipDisabled: boolean;
  skipLabel: string;
  helperText?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/20 bg-violet-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/map" className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
          ← Map
        </Link>

        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-violet-200/80">Lavender Quest</p>
          <h1 className="text-sm font-semibold text-white">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-violet-100">
            Credits: <span className="ml-1 text-white">{credits}</span>
          </div>
          <SkipLevelButton disabled={skipDisabled} onClick={onSkip}>
            {skipLabel}
          </SkipLevelButton>
        </div>
      </div>
      {helperText ? (
        <div className="border-t border-white/10 bg-violet-950/60 px-4 py-2 text-center text-sm text-violet-100 sm:px-6">
          {helperText}
        </div>
      ) : null}
    </header>
  );
}
