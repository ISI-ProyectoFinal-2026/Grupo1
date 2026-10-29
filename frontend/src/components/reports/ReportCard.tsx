import { Link } from "react-router-dom";
import type { ReportDTO } from "@/types/report.types";
import { PinIcon } from "@/components/ui/icons";
import { DogFace } from "@/components/ui/canine";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { tagTone } from "@/lib/tag-tone";

interface ReportCardProps {
  report: ReportDTO;
}

// La foto es la protagonista (como en un afiche pegado en un poste) y la
// etiqueta de estado va encima, como el sticker del afiche.
export default function ReportCard({ report }: ReportCardProps) {
  return (
    <Link
      to={`/reports/${report.id}`}
      className="group block h-full rounded-card transition-transform duration-press ease-out active:scale-[0.985]"
    >
      {/* La sombra de hover vive en un pseudo-elemento: se anima solo su opacidad. */}
      <article
        className={cn(
          "card relative flex h-full flex-col transition-[transform,border-color] duration-base ease-out",
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-card after:opacity-0 after:shadow-lift after:transition-opacity after:duration-base after:ease-out",
          "group-hover:-translate-y-0.5 group-hover:border-ink-muted/60 group-hover:after:opacity-100",
        )}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-[15px] bg-surface">
          {report.imageUrl ? (
            // Absolute so a portrait photo can't stretch the box past 4:3: an
            // in-flow image raises the aspect-ratio box's automatic min-height.
            <img
              src={report.imageUrl}
              alt={report.title}
              width={400}
              height={300}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-signal-soft text-ink-muted">
              <DogFace className="w-20" />
              <span className="text-sm">Sin foto</span>
            </div>
          )}
          {report.tag && (
            <span
              className="tag-sticker absolute left-3 top-3 -rotate-3"
              style={{ backgroundColor: tagTone(report.tag) }}
            >
              {report.tag.label}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          {/* Fixed text rows (1-line title, 2-line description) keep every card the same height. */}
          <h3 title={report.title} className="truncate font-display text-display-sm text-ink">
            {report.title}
          </h3>
          <p className="line-clamp-2 min-h-[2lh] break-words text-sm text-ink-muted">
            {report.description || "Sin descripción"}
          </p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-sm">
            <p className="flex min-w-0 items-center gap-1 font-bold text-ink">
              <PinIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{report.locationAddress || "Ubicación desconocida"}</span>
            </p>
            <time dateTime={report.createdAt} className="shrink-0 text-ink-muted">
              {formatRelativeDate(report.createdAt)}
            </time>
          </div>
        </div>
      </article>
    </Link>
  );
}
