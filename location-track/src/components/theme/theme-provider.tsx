"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = "location-attendance-theme";
const THEME_COOKIE_NAME = "location-attendance-theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

function applyTheme(mode: ThemeMode, resolvedTheme: ResolvedTheme) {
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = resolvedTheme;
}

function persistThemeMode(mode: ThemeMode) {
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  document.cookie = `${THEME_COOKIE_NAME}=${mode}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function ThemeProvider({
  children,
  initialMode = "system",
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}) {
  const initialResolvedTheme =
    initialMode === "system" ? "light" : initialMode;
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [resolvedTheme, setResolvedTheme] =
    useState<ResolvedTheme>(initialResolvedTheme);

  const setMode = useCallback((nextMode: ThemeMode) => {
    const nextResolvedTheme =
      nextMode === "system" ? getSystemTheme() : nextMode;

    setModeState(nextMode);
    setResolvedTheme(nextResolvedTheme);
    persistThemeMode(nextMode);
    applyTheme(nextMode, nextResolvedTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setMode]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
      const nextMode = isThemeMode(storedMode) ? storedMode : initialMode;
      const nextResolvedTheme =
        nextMode === "system" ? getSystemTheme() : nextMode;

      persistThemeMode(nextMode);
      setModeState(nextMode);
      setResolvedTheme(nextResolvedTheme);
      applyTheme(nextMode, nextResolvedTheme);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialMode]);

  useEffect(() => {
    if (mode !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange(event: MediaQueryListEvent) {
      const nextResolvedTheme = event.matches ? "dark" : "light";
      setResolvedTheme(nextResolvedTheme);
      applyTheme("system", nextResolvedTheme);
    }

    media.addEventListener("change", handleSystemThemeChange);

    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      setMode,
      toggleTheme,
    }),
    [mode, resolvedTheme, setMode, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return value;
}
