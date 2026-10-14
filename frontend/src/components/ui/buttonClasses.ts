import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "signal" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-ink/90",
  secondary: "border border-line bg-paper text-ink hover:border-ink-muted hover:bg-surface",
  danger: "bg-danger text-white hover:bg-danger/90",
  signal: "bg-signal text-ink hover:bg-signal-deep",
  ghost: "text-ink hover:bg-ink/5",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3.5 text-sm",
  md: "min-h-11 px-4 text-base",
  lg: "min-h-12 px-5 text-base",
};

/**
 * Clases de boton reutilizables, tambien para un <Link> que tiene que verse
 * como boton (navegar sigue siendo un link, no un boton con onClick).
 */
export function buttonClasses(variant: ButtonVariant, size: ButtonSize = "md", className = "") {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-control font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}
