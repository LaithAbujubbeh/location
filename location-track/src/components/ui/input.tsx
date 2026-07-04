import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex min-h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)] transition-colors",
        "placeholder:text-text-subtle disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
