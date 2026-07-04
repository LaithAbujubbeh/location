"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/cn";

type ThemeToggleLabels = {
  ariaLabel: string;
  light: string;
  dark: string;
  system: string;
};

type ThemeToggleProps = {
  className?: string;
  labels: ThemeToggleLabels;
};

export function ThemeToggle({ className, labels }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();

  return (
    <div
      aria-label={labels.ariaLabel}
      className={cn(
        "inline-flex max-w-full rounded-md border border-border bg-surface p-1 shadow-[var(--shadow-sm)]",
        className,
      )}
      role="group"
    >
      {(["light", "dark", "system"] as const).map((themeMode) => (
        <Button
          aria-pressed={mode === themeMode}
          className="h-8 min-w-0 flex-1 px-2 text-xs capitalize sm:px-3"
          key={themeMode}
          onClick={() => setMode(themeMode)}
          type="button"
          variant={mode === themeMode ? "primary" : "ghost"}
        >
          {labels[themeMode]}
        </Button>
      ))}
    </div>
  );
}
