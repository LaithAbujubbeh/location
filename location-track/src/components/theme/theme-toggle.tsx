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
        "inline-flex w-full max-w-full min-w-0 rounded-md border border-border bg-surface p-1 shadow-[var(--shadow-sm)]",
        className,
      )}
      role="group"
    >
      {(["light", "dark", "system"] as const).map((themeMode) => (
        <Button
          aria-pressed={mode === themeMode}
          className="min-w-0 flex-1 basis-0 px-2 text-xs capitalize leading-tight sm:px-3"
          key={themeMode}
          onClick={() => setMode(themeMode)}
          size="sm"
          type="button"
          variant={mode === themeMode ? "primary" : "ghost"}
        >
          {labels[themeMode]}
        </Button>
      ))}
    </div>
  );
}
