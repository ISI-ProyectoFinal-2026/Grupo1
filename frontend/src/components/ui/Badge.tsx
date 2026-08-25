interface BadgeProps {
  label: string;
  color?: string;
  backgroundColor?: string;
}

function Badge({ label, color, backgroundColor }: BadgeProps) {
  const bgColor = backgroundColor || color;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: bgColor }}
    >
      {label}
    </span>
  );
}

export default Badge;
