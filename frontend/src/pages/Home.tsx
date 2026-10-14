import type { ComponentType, SVGProps } from "react";
import { Link } from "react-router-dom";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { CameraIcon, ChatIcon, PawIcon, PinIcon, SparkIcon } from "@/components/ui/icons";

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
    <div aria-hidden="true" className="relative mx-auto w-48 rotate-2 sm:w-64">
      <span className="absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 -rotate-3 bg-signal/80" />
      <div className="card overflow-hidden p-3 shadow-pop">
        <div className="relative grid aspect-[4/5] place-items-center rounded-[10px] bg-surface text-ink-muted">
          <PawIcon className="h-16 w-16" strokeWidth={1.5} />
          <span className="tag-sticker absolute left-3 top-3 -rotate-6 bg-danger">Perdido</span>
        </div>
        <p className="mt-3 font-display text-display-sm text-ink">Toby, caniche blanco</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
          <PinIcon className="h-4 w-4" />
          Palermo
        </p>
      </div>
    </div>
  );
}

function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="font-display text-display-lg sm:text-display-xl">
            Con <span translate="no" className="whitespace-nowrap">PATITAS</span>, las mascotas
            perdidas vuelven a casa
          </h1>
          <p className="mt-4 max-w-prose text-lg text-ink-muted">
            Ayudá a encontrar mascotas perdidas con matching automático visual
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

      <section aria-labelledby="como-funciona" className="mt-14 border-t border-line pt-8">
        <h2 id="como-funciona" className="font-display text-display-md">
          Cómo funciona
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 md:flex-col md:gap-3">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-paper text-ink ring-1 ring-line">
                <step.icon className="h-6 w-6" />
                <span className="tabular absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">
                  {index + 1}
                </span>
              </span>
              <div>
                <h3 className="font-display text-display-sm">{step.title}</h3>
                <p className="mt-1 text-ink-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default Home;
