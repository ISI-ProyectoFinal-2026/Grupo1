import { cn } from "@/lib/cn";

// comercio Premium vigente (ADR-0024)
function FeaturedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full bg-signal px-2.5 py-1 text-xs font-bold leading-none text-ink",
        className,
      )}
    >
      Destacado
    </span>
  );
}

export default FeaturedBadge;
