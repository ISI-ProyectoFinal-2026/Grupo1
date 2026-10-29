import { cn } from "@/lib/cn";

// Piezas decorativas con forma de perro: siempre aria-hidden.

interface DecorProps {
  className?: string;
}

/* Huella rellena, misma geometria que PawIcon */
function PawPrintShape() {
  return (
    <>
      <circle cx="5.5" cy="10" r="2.3" />
      <circle cx="9.5" cy="5.5" r="2.3" />
      <circle cx="14.5" cy="5.5" r="2.3" />
      <circle cx="18.5" cy="10" r="2.3" />
      <path d="M12 11.5c-2.6 0-5.5 3.4-5.5 6 0 1.6 1.2 2.5 2.7 2.5 1.2 0 1.8-.6 2.8-.6s1.6.6 2.8.6c1.5 0 2.7-.9 2.7-2.5 0-2.6-2.9-6-5.5-6Z" />
    </>
  );
}

export function PawPrint({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <PawPrintShape />
    </svg>
  );
}

/* Rastro de huellas que sube hasta la tarjeta */
const TRAIL = Array.from({ length: 7 }, (_, i) => {
  const t = i / 6;
  return { x: 40 + 70 * t + (i % 2 ? 13 : -13), y: 410 - 360 * t };
});

export function PawTrail({ className }: DecorProps) {
  return (
    <svg
      viewBox="0 0 160 440"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn("paw-trail", className)}
    >
      {TRAIL.map((step, i) => (
        <g key={i} transform={`translate(${step.x - 12} ${step.y - 12}) rotate(${i % 2 ? 18 : 4} 12 12)`}>
          <g className="paw-step" style={{ animationDelay: `${300 + i * 110}ms` }}>
            <PawPrintShape />
          </g>
        </g>
      ))}
    </svg>
  );
}

/* Cabeza del perro caramelo (unidades del viewBox 96 de ancho) */
function DogHeadShape() {
  return (
    <g className="dog-head">
      <path
        className="dog-ear dog-ear-left"
        d="M33 28C24 20 12 24 12 36c0 10 6 16 12 14 5-8 8-14 9-22Z"
        fill="rgb(var(--color-caramel))"
        stroke="rgb(var(--color-ink))"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        className="dog-ear dog-ear-right"
        d="M63 28c9-8 21-4 21 8 0 10-6 16-12 14-5-8-8-14-9-22Z"
        fill="rgb(var(--color-caramel))"
        stroke="rgb(var(--color-ink))"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <ellipse
        cx="48"
        cy="46"
        rx="22"
        ry="21"
        fill="rgb(var(--color-caramel-soft))"
        stroke="rgb(var(--color-ink))"
        strokeWidth="2.5"
      />
      <ellipse cx="48" cy="53" rx="11" ry="8" fill="rgb(var(--color-paper))" />
      <g fill="rgb(var(--color-ink))">
        <circle className="dog-eye" cx="40" cy="41" r="2.8" />
        <circle className="dog-eye" cx="56" cy="41" r="2.8" />
        <ellipse className="dog-nose" cx="48" cy="50" rx="4.5" ry="3.2" />
      </g>
    </g>
  );
}

/* Perro asomado sobre el borde de la tarjeta (96x64, unidades = px) */
export function DogPeek({ className }: DecorProps) {
  return (
    <svg
      viewBox="0 0 96 64"
      width={96}
      height={64}
      aria-hidden="true"
      focusable="false"
      className={cn("dog-peek", className)}
    >
      <DogHeadShape />
    </svg>
  );
}

/* Cara completa, para afiches y placeholders */
export function DogFace({ className }: DecorProps) {
  return (
    <svg viewBox="8 18 80 54" aria-hidden="true" focusable="false" className={className}>
      <DogHeadShape />
    </svg>
  );
}

/* Patas apoyadas sobre el borde (van delante de la tarjeta) */
export function DogPeekPaws({ className }: DecorProps) {
  return (
    <svg
      viewBox="0 0 96 14"
      width={96}
      height={14}
      aria-hidden="true"
      focusable="false"
      className={cn("dog-paws", className)}
    >
      <g fill="rgb(var(--color-paper))" stroke="rgb(var(--color-ink))" strokeWidth="2.5" strokeLinecap="round">
        <rect x="27" y="2" width="16" height="10" rx="5" />
        <rect x="53" y="2" width="16" height="10" rx="5" />
        <path d="M32 7.5v3M37.5 7.5v3M58 7.5v3M63.5 7.5v3" strokeWidth="1.75" />
      </g>
    </svg>
  );
}

/* Perro de perfil olfateando el piso */
export function SniffingDog({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 160 100" aria-hidden="true" focusable="false" className={cn("sniffing-dog", className)}>
      <line x1="8" y1="92" x2="152" y2="92" stroke="rgb(var(--color-caramel) / 0.35)" strokeWidth="3" strokeLinecap="round" />
      <g stroke="rgb(var(--color-ink))" strokeWidth="3" strokeLinecap="round" fill="none">
        <path className="dog-tail" d="M121 50c12-6 16-16 13-27" />
        <path d="M72 64v26M84 66v24M106 66v24M116 64v26" />
      </g>
      <rect
        x="60"
        y="40"
        width="64"
        height="30"
        rx="15"
        fill="rgb(var(--color-caramel-soft))"
        stroke="rgb(var(--color-ink))"
        strokeWidth="3"
      />
      <g className="dog-sniff-head">
        <ellipse
          cx="38"
          cy="74"
          rx="10"
          ry="7"
          transform="rotate(35 38 74)"
          fill="rgb(var(--color-caramel-soft))"
          stroke="rgb(var(--color-ink))"
          strokeWidth="3"
        />
        <circle cx="52" cy="62" r="13" fill="rgb(var(--color-caramel-soft))" stroke="rgb(var(--color-ink))" strokeWidth="3" />
        <path d="M54 50c8 2 10 12 6 22-4-2-8-10-6-22Z" fill="rgb(var(--color-caramel))" stroke="rgb(var(--color-ink))" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="47" cy="60" r="2" fill="rgb(var(--color-ink))" />
        <circle cx="31" cy="80" r="3.5" fill="rgb(var(--color-ink))" />
      </g>
      <g fill="rgb(var(--color-signal))">
        <circle className="dog-scent" cx="20" cy="84" r="2.5" />
        <circle className="dog-scent" cx="13" cy="77" r="2" style={{ animationDelay: "160ms" }} />
      </g>
    </svg>
  );
}

/* Chapita de collar con forma de hueso */
export function BoneTag({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 80 48" aria-hidden="true" focusable="false" className={className}>
      <g fill="rgb(var(--color-signal))">
        <rect x="14" y="13" width="52" height="22" rx="4" />
        <circle cx="16" cy="14" r="10" />
        <circle cx="16" cy="34" r="10" />
        <circle cx="64" cy="14" r="10" />
        <circle cx="64" cy="34" r="10" />
      </g>
      <g transform="translate(30 14) scale(0.83)" fill="rgb(var(--color-ink))">
        <PawPrintShape />
      </g>
    </svg>
  );
}
