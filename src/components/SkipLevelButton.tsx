type SkipLevelButtonProps = {
  disabled: boolean;
  onClick: () => void;
  children?: React.ReactNode;
};

export function SkipLevelButton({ disabled, onClick, children }: SkipLevelButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-semibold shadow-glow transition-all duration-200 ${
        disabled
          ? "cursor-not-allowed border border-violet-200/70 bg-white/60 text-violet-300"
          : "border border-violet-400/30 bg-violet-600 text-white hover:scale-[1.02] hover:bg-violet-700"
      }`}
    >
      {children}
    </button>
  );
}
