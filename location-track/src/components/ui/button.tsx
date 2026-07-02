import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[var(--shadow-sm)] hover:bg-primary-hover",
  secondary:
    "bg-surface-muted text-primary-dark hover:bg-primary-soft dark:text-foreground",
  outline:
    "border border-border bg-surface text-foreground hover:bg-surface-subtle",
  ghost: "bg-transparent text-text-muted hover:bg-surface-subtle hover:text-foreground",
  danger: "bg-danger text-on-primary shadow-[var(--shadow-sm)] hover:brightness-95",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "active:translate-y-px",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
