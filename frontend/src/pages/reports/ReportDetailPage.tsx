import { Link, useLocation, useParams } from "react-router-dom";
import { useReportDetailQuery } from "@/hooks/useReportDetailQuery";
import { useReportMatchesQuery } from "@/hooks/useReportMatchesQuery";
import { useCloseReport } from "@/hooks/useCloseReport";
import { useFlagReport } from "@/hooks/useFlagReport";
import { useAuthStore } from "@/stores/auth.store";
import { useHelpBarOffset } from "@/hooks/useHelpBarOffset";
import { buttonClasses } from "@/components/ui/buttonClasses";
import ErrorMessage from "@/components/ui/ErrorMessage";
import SuccessMessage from "@/components/ui/SuccessMessage";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { getApiErrorStatus } from "@/services/api";
import PendingBanner from "@/components/reports/PendingBanner";
import ReportPhotoGallery from "@/components/reports/ReportPhotoGallery";
import ReportFlagReasonForm from "@/components/reports/ReportFlagReasonForm";
import HiddenReportNotice from "@/components/reports/HiddenReportNotice";
import ReportAccountForm from "@/components/reports/ReportAccountForm";
import ReportFlyerSection from "@/components/reports/ReportFlyerSection";
import ReportMatchesList from "@/components/reports/ReportMatchesList";
import ReportOwnerActions from "@/components/reports/ReportOwnerActions";
import ContactOwnerPanel from "@/components/reports/ContactOwnerPanel";
import ReportDetailSkeleton from "@/components/reports/ReportDetailSkeleton";
import ReportFacts from "@/components/reports/ReportFacts";
import LocationMap from "@/components/maps/LocationMap";
import AdBanner from "@/components/ads/AdBanner";
import NearbyBusinesses from "@/components/business/NearbyBusinesses";
import { cn } from "@/lib/cn";
import { DogFace } from "@/components/ui/canine";
import { tagTone } from "@/lib/tag-tone";
import ReportTypeBadge from "@/components/reports/ReportTypeBadge";
import { REPORT_STATUS_LABELS } from "@/lib/report-status";

const sectionTitle = "font-display text-display-sm text-ink";

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const helpBarRef = useHelpBarOffset();
  // Aviso que deja la pantalla anterior (alta o edición del reporte).
  const flashMessage = (useLocation().state as { message?: string } | null)?.message;

  const { data: report, isLoading, error } = useReportDetailQuery(id ? Number(id) : undefined);
  const { data: matches, isLoading: isLoadingMatches } = useReportMatchesQuery(
    id ? Number(id) : undefined,
    report?.status,
  );
  const closeReport = useCloseReport(Number(id));
  const flagReport = useFlagReport(Number(id));
  const currentUserId = useAuthStore((state) => state.user?.id);

  if (isLoading) return <ReportDetailSkeleton />;

  // 404: oculto, rechazado, eliminado o de un autor suspendido (#187)
  if (getApiErrorStatus(error) === 404) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="card p-5 sm:p-6">
          <h1 className="font-display text-display-md">Este reporte ya no está disponible</h1>
          <p className="mt-2 text-ink-muted">
            Puede que lo hayan eliminado o que esté oculto. Seguí buscando en el resto de los reportes.
          </p>
        </div>
        <Link to="/reports" className={buttonClasses("secondary", "md", "mt-4")}>
          Volver a reportes
        </Link>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <ErrorMessage message="Error al cargar el reporte" className="card p-4" />
        <Link to="/reports" className={buttonClasses("secondary", "md", "mt-4")}>
          Volver a reportes
        </Link>
      </div>
    );
  }

  const isOwner = currentUserId === report.userId;
  // Solo un reporte publicado se cierra o se denuncia: pending todavía está en
  // moderación automática y rejected ya fue ocultado por un moderador; cerrarlo
  // lo pasaría a resolved y lo volvería a mostrar.
  const isPublished = report.status === "published";
  const canFlag = isPublished && currentUserId !== undefined && !isOwner;
  const canContact = currentUserId !== undefined && currentUserId !== report.userId;
  const canClose = isOwner && isPublished;
  // tras confirmar una coincidencia se ofrece cerrar el propio reporte (#221)
  const offerClose = canClose && (matches?.some((match) => match.status === "confirmed") ?? false);
  // oculto por denuncias: el dueño no edita ni cierra, solo elimina
  const isHidden = report.status === "hidden";
  // denuncia la cuenta del autor, no la publicación (#267)
  const canReportAccount = currentUserId !== undefined && !isOwner;
  const hasActions = canContact || isOwner || canFlag || canReportAccount;
  // las coincidencias exigen sesión en el backend (#175); el visitante no las ve (#187)
  const canSeeMatches = currentUserId !== undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-4 pt-2 sm:px-6 lg:py-6">
      <Link
        to="/reports"
        className="press group -ml-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 font-bold text-ink-muted hover:text-ink"
      >
        <ChevronLeftIcon className="h-5 w-5 transition-transform duration-fast ease-out group-hover:-translate-x-0.5" />
        Volver
      </Link>

      {flashMessage && <SuccessMessage message={flashMessage} className="mt-2 animate-drop" />}

      {/* Una sola grilla: en mobile el panel de acciones queda último en el
          flujo y se pega abajo (sticky) sobre la tab bar; en desktop pasa a la
          columna derecha, arriba de las coincidencias. */}
      <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:grid-rows-[auto_1fr] lg:gap-8">
        <article className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="relative -mx-4 overflow-hidden bg-surface sm:mx-0 sm:rounded-card sm:border sm:border-line sm:shadow-card">
            {report.imageUrl ? (
              <ReportPhotoGallery mainUrl={report.imageUrl} extraUrls={report.extraImageUrls} alt={report.title} />
            ) : (
              <div className="flex aspect-[16/9] flex-col items-center justify-center gap-3 bg-signal-soft text-ink-muted">
                <DogFace className="w-32" />
                <span>Sin foto</span>
              </div>
            )}
            {report.tag && (
              <span
                className="tag-sticker absolute left-4 top-4 -rotate-3 px-4 py-2 text-base shadow-pop"
                style={{ backgroundColor: tagTone(report.tag) }}
              >
                {report.tag.label}
              </span>
            )}
          </div>

          <ReportTypeBadge reportType={report.reportType} className="mt-5" />
          <h1 className="mt-3 break-words font-display text-display-lg sm:text-display-xl">{report.title}</h1>

          <ReportFacts report={report} />

          {report.location && (
            <section aria-label="Mapa de la ubicación" className="mt-5">
              <LocationMap
                location={report.location}
                label={report.locationAddress || report.title}
                reportType={report.reportType}
              />
            </section>
          )}

          {report.description && (
            <section className="mt-6">
              <h2 className={sectionTitle}>Descripción</h2>
              <p className="mt-2 max-w-prose whitespace-pre-wrap break-words text-ink">{report.description}</p>
            </section>
          )}

          <p className="mt-6 text-sm text-ink-muted">
            Estado: <span className="font-bold text-ink">{REPORT_STATUS_LABELS[report.status]}</span>
          </p>

          {isOwner && isHidden && (
            <div className="mt-4">
              <HiddenReportNotice hiddenReasons={report.hiddenReasons} />
            </div>
          )}

          {report.status !== "pending" && (
            <ReportFlyerSection
              reportId={Number(id)}
              title={report.title}
              customFlyerUrl={report.customFlyerUrl}
              canUploadCustom={isOwner}
            />
          )}
        </article>

        <section
          className="min-w-0 lg:col-start-2 lg:row-start-2 lg:self-start"
          aria-labelledby={canSeeMatches ? "coincidencias" : undefined}
        >
          {report.status === "pending" ? (
            <PendingBanner />
          ) : (
            <>
              {canSeeMatches && (
                <ReportMatchesList
                  reportId={Number(id)}
                  matches={matches}
                  isLoading={isLoadingMatches}
                  canManage={isOwner}
                  offerClose={offerClose}
                  closeReport={closeReport}
                />
              )}

              {/* publicidad y comercios cerca de la ubicación del reporte (ADR-0024) */}
              <div className={cn("flex flex-col gap-4", canSeeMatches && "mt-6")}>
                <NearbyBusinesses reportId={report.id} />
                <AdBanner placement="report_detail" reportId={report.id} />
              </div>
            </>
          )}
        </section>

        {hasActions && (
          <aside
            ref={helpBarRef}
            aria-label="Acciones del reporte"
            className={cn(
              "sticky bottom-above-tabbar z-20 -mx-4 flex max-h-[60vh] flex-col gap-2 overflow-y-auto overscroll-contain border-t border-line bg-paper px-4 py-3 shadow-sheet sm:-mx-6 sm:px-6",
              "lg:static lg:col-start-2 lg:row-start-1 lg:mx-0 lg:max-h-none lg:gap-3 lg:rounded-card lg:border lg:p-5 lg:shadow-card",
            )}
          >
            {canContact && <ContactOwnerPanel reportId={Number(id)} ownerId={report.userId} />}

            {isOwner && (
              <ReportOwnerActions
                report={report}
                reportId={Number(id)}
                canClose={canClose}
                closeReport={closeReport}
              />
            )}

            {canFlag && (
              <ReportFlagReasonForm
                onSubmit={flagReport.flag}
                isPending={flagReport.isPending}
                isSent={flagReport.isSent}
                isDone={flagReport.isDone}
                error={flagReport.error}
              />
            )}

            {canReportAccount && <ReportAccountForm reportedUserId={report.userId} />}
          </aside>
        )}
      </div>
    </div>
  );
}
