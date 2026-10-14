import { Link } from "react-router-dom";
import type { MatchDTO } from "@/types/report.types";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { PawIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/format";

interface MatchCardProps {
  match: MatchDTO;
  canManage?: boolean;
  onConfirm?: (matchId: number) => void;
  onReject?: (matchId: number) => void;
  isBusy?: boolean;
  error?: string | null;
}

const REPORT_TYPE_LABEL: Record<MatchDTO["reportType"], string> = {
  lost: "Perdido",
  found: "Encontrado",
};

// Tonos con contraste AA contra el texto blanco de la pastilla.
const REPORT_TYPE_COLOR: Record<MatchDTO["reportType"], string> = {
  lost: "#D93636",
  found: "#2563EB",
};

const CONFIRMED_COLOR = "#176B47";

export default function MatchCard({
  match,
  canManage = false,
  onConfirm,
  onReject,
  isBusy = false,
  error = null,
}: MatchCardProps) {
  const showActions = canManage && match.status === "pending";

  return (
    <div className="card overflow-hidden">
      <Link
        to={`/reports/${match.reportId}`}
        className="flex gap-3 p-3 transition-colors hover:bg-surface"
      >
        {match.imageUrl ? (
          <img
            src={match.imageUrl}
            alt={match.title}
            width={88}
            height={88}
            loading="lazy"
            className="h-[88px] w-[88px] shrink-0 rounded-[10px] object-cover"
          />
        ) : (
          <div className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-[10px] bg-surface text-ink-muted">
            <PawIcon className="h-8 w-8" strokeWidth={1.5} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="line-clamp-2 break-words font-display text-base font-bold leading-snug text-ink">
            {match.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              label={REPORT_TYPE_LABEL[match.reportType]}
              backgroundColor={REPORT_TYPE_COLOR[match.reportType]}
            />
            {match.status === "confirmed" && (
              <Badge label="Coincidencia confirmada" backgroundColor={CONFIRMED_COLOR} />
            )}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 text-sm">
            {match.similarityScore !== null && (
              <p className="tabular font-bold text-ink">
                {Math.round(match.similarityScore * 100)}% de coincidencia
              </p>
            )}
            <time dateTime={match.createdAt} className="ml-auto shrink-0 text-ink-muted">
              {formatRelativeDate(match.createdAt)}
            </time>
          </div>
        </div>
      </Link>

      {showActions && (
        <div className="flex flex-col gap-2 border-t border-line p-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={isBusy}
              onClick={() => onConfirm?.(match.matchId)}
            >
              Confirmar coincidencia
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() => onReject?.(match.matchId)}
            >
              Descartar
            </Button>
          </div>
          {error && <ErrorMessage message={error} />}
        </div>
      )}
    </div>
  );
}
