import type { ComponentType, SVGProps } from "react";
import { Link } from "react-router-dom";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { CameraIcon, ChatIcon, PinIcon, SparkIcon } from "@/components/ui/icons";
import { DogFace, PawPrint } from "@/components/ui/canine";
import { cn } from "@/lib/cn";

interface Step {
  title: string;
  text: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const STEPS: Step[] = [
  { title: "Sube una foto", text: "Reportá tu mascota con una foto clara", icon: CameraIcon },
  { title: "IA detecta similitud", text: "Nuestro sistema busca matches automáticamente", icon: SparkIcon },
  { title: "Conectá con otros", text: "Chateá con personas que encontraron tu mascota", icon: ChatIcon },
];

// Afiche decorativo del hero: el mismo lenguaje visual que las tarjetas del feed.
function PosterIllustration() {
  return (
    // La animación va en un envoltorio: el afiche ya usa transform (rotate).
    <div aria-hidden="true" className="animate-pop" style={{ animationDelay: "120ms" }}>
      <div className="relative mx-auto w-48 rotate-2 sm:w-64">
        <span className="absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 -rotate-3 bg-signal/80" />
        <div className="card overflow-hidden p-3 shadow-lift">
          <div className="relative grid aspect-[4/5] place-items-center rounded-[10px] bg-signal-soft">
            <DogFace className="w-32 sm:w-40" />
            <span className="tag-sticker absolute left-3 top-3 -rotate-6 bg-lost">PERDIDO</span>
          </div>
          <p className="mt-3 font-display text-display-sm text-ink">Toby, caniche blanco</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
            <PinIcon className="h-4 w-4" />
            Palermo
          </p>
          {/* Tiritas para arrancar, una ya se la llevaron */}
          <div className="-mx-3 -mb-3 mt-3 grid grid-cols-6 border-t border-dashed border-line">
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "grid h-11 place-items-center border-dashed border-line text-ink-muted [&:not(:last-child)]:border-r",
                  i === 2 && "bg-surface",
                )}
              >
                {i !== 2 && <PawPrint className="h-3.5 w-3.5" />}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="animate-rise font-display text-display-lg sm:text-display-xl">
            Con <span translate="no" className="whitespace-nowrap">PATITAS</span>, las mascotas
            perdidas vuelven a casa
          </h1>
          <p className="mt-4 max-w-prose animate-rise text-lg text-ink-muted" style={{ animationDelay: "60ms" }}>
            Ayudá a encontrar mascotas perdidas con matching automático visual
          </p>
          <div className="mt-8 flex animate-rise flex-col gap-3 sm:flex-row" style={{ animationDelay: "120ms" }}>
            <Link to="/reports" className={buttonClasses("primary", "lg", "sm:min-w-44")}>
              Ver Reportes
            </Link>
            <Link to="/reports/new" className={buttonClasses("signal", "lg", "sm:min-w-44")}>
              Crear Reporte
            </Link>
          </div>
        </div>
        <PosterIllustration />
      </section>

      {/* Pasos sobre un campo de oro, unidos por un rastro de huellas */}
      <section
        aria-labelledby="como-funciona"
        className="mt-14 rounded-card bg-signal-soft px-5 py-8 sm:px-8 lg:mt-20"
      >
        <h2 id="como-funciona" className="font-display text-display-md text-ink">
          Cómo funciona
        </h2>
        <ol className="mt-6 grid gap-7 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative flex animate-rise gap-4 md:flex-col md:gap-3"
              style={{ animationDelay: `${200 + index * 60}ms` }}
            >
              <step.icon className="h-8 w-8 shrink-0 text-signal-ink" strokeWidth={1.75} />
              {index < STEPS.length - 1 && (
                <span aria-hidden="true" className="absolute left-14 top-3 hidden gap-2 text-signal-deep/60 md:flex">
                  <PawPrint className="h-3.5 w-3.5 rotate-90" />
                  <PawPrint className="mt-1.5 h-3.5 w-3.5 rotate-90" />
                  <PawPrint className="h-3.5 w-3.5 rotate-90" />
                </span>
              )}
              <div>
                <h3 className="font-display text-display-sm">{step.title}</h3>
                <p className="mt-1 text-ink">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default Home;
