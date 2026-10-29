import type { ReactNode } from "react";
import { DogPeek, DogPeekPaws, PawTrail, SniffingDog } from "@/components/ui/canine";

interface AuthFrameProps {
  children: ReactNode;
  footer?: ReactNode;
}

/** Marco de las pantallas sin sesion: tarjeta con el perro asomado. */
export function AuthFrame({ children, footer }: AuthFrameProps) {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 pb-12 pt-16 sm:pt-20 lg:grid-cols-[1fr_24rem] lg:gap-16 lg:px-6 lg:pt-12">
      {/* Panel decorativo de escritorio: campo de oro con el perro rastreando */}
      <div
        aria-hidden="true"
        className="relative hidden min-h-[30rem] overflow-hidden rounded-card bg-signal-soft p-10 lg:flex lg:flex-col lg:justify-between"
      >
        <p className="letra-filete max-w-[20ch] text-[2.25rem] leading-[1.1] text-ink">Las mascotas perdidas vuelven a casa</p>
        <PawTrail className="pointer-events-none absolute right-10 top-8 h-72 w-28 rotate-12 text-signal-deep/45" />
        <SniffingDog className="w-80" />
      </div>
      <div className="auth-frame relative mx-auto w-full max-w-sm animate-rise">
        <DogPeek className="pointer-events-none absolute bottom-[calc(100%-8px)] right-6" />
        <div className="card relative z-10 p-5 sm:p-7">{children}</div>
        <DogPeekPaws className="pointer-events-none absolute -top-[7px] right-6 z-20" />
        {footer && <div className="mt-5 text-center text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Contenedor centrado de las pantallas sin sesion (login, registro). */
function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <AuthFrame footer={footer}>
      <h1 className="font-display text-display-md">{title}</h1>
      {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      {children}
    </AuthFrame>
  );
}

export default AuthCard;
