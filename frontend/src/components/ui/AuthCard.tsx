import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Contenedor centrado de las pantallas sin sesion (login, registro). */
function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex justify-center px-4 pb-12 pt-4 sm:pt-12">
      <div className="w-full max-w-sm">
        <div className="card p-5 sm:p-7">
          <h1 className="font-display text-display-md">{title}</h1>
          {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}

export default AuthCard;
