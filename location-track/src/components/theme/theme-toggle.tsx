"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";

type ThemeToggleLabels = {
  ariaLabel: string;
  light: string;
  dark: string;
  system: string;
};

type ThemeToggleProps = {
  labels: ThemeToggleLabels;
};

export function ThemeToggle({ labels }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();

  return (
    <div
      aria-label={labels.ariaLabel}
      className="inline-flex rounded-md border border-border bg-surface p-1 shadow-[var(--shadow-sm)]"
      role="group"
    >
      {(["light", "dark", "system"] as const).map((themeMode) => (
        <Button
          aria-pressed={mode === themeMode}
          className="h-8 px-3 text-xs capitalize"
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
