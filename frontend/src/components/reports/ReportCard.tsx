import { Link } from "react-router-dom";
import type { ReportDTO } from "@/types/report.types";
import { PawIcon, PinIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/format";

interface ReportCardProps {
  report: ReportDTO;
}

// La foto es la protagonista (como en un afiche pegado en un poste) y la
// etiqueta de estado va encima, como el sticker del afiche.
export default function ReportCard({ report }: ReportCardProps) {
  return (
    <Link to={`/reports/${report.id}`} className="group block h-full rounded-card">
      <article className="card flex h-full flex-col overflow-hidden transition-colors duration-150 group-hover:border-ink-muted">
        <div className="relative aspect-[4/3] bg-surface">
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
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-ink-muted">
              <PawIcon className="h-10 w-10" strokeWidth={1.5} />
              <span className="text-sm">Sin foto</span>
            </div>
          )}
          {report.tag && (
            <span
              className="tag-sticker absolute left-3 top-3 -rotate-3"
              style={{ backgroundColor: report.tag.color }}
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
