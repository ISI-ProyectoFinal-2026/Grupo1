import { cn } from "@/lib/cn";

interface BadgeProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  className?: string;
}

// Pastilla de estado. El color llega de afuera (la API define los colores de
// las etiquetas), por eso va inline.
function Badge({ label, color, backgroundColor, className }: BadgeProps) {
  const bgColor = backgroundColor || color;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold leading-none text-white",
        className,
      )}
      style={{ backgroundColor: bgColor }}
    >
      {label}
    </span>
  );
}

export default Badge;
