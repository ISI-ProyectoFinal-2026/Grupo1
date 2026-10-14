import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useReportDetailQuery } from "@/hooks/useReportDetailQuery";
import { useReportMatchesQuery } from "@/hooks/useReportMatchesQuery";
import { useMatchActions } from "@/hooks/useMatchActions";
import { useCloseReport } from "@/hooks/useCloseReport";
import { useFlagReport } from "@/hooks/useFlagReport";
import { getFlyer, uploadCustomFlyer } from "@/services/reports.service";
import { createChat } from "@/services/chats.service";
import { useAuthStore } from "@/stores/auth.store";
import Button from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonClasses";
import Spinner from "@/components/ui/Spinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { CalendarIcon, ChatIcon, ChevronLeftIcon, PawIcon, PinIcon } from "@/components/ui/icons";
import EmailNotVerifiedNotice from "@/components/auth/EmailNotVerifiedNotice";
import { getApiErrorCode } from "@/services/api";
import { EMAIL_NOT_VERIFIED } from "@/types/auth";
import PendingBanner from "@/components/reports/PendingBanner";
import MatchCard from "@/components/reports/MatchCard";
import ImageUploader from "@/components/reports/ImageUploader";
import CloseReportButton from "@/components/reports/CloseReportButton";
import FlagReportForm from "@/components/reports/FlagReportForm";
import { cn } from "@/lib/cn";
import { REPORT_STATUS_LABELS } from "@/lib/report-status";

const sectionTitle = "font-display text-display-sm text-ink";

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: report, isLoading, error } = useReportDetailQuery(id ? Number(id) : undefined);
  const { data: matches, isLoading: isLoadingMatches } = useReportMatchesQuery(
    id ? Number(id) : undefined,
    report?.status,
  );
  const matchActions = useMatchActions(Number(id));
  const closeReport = useCloseReport(Number(id));
  const flagReport = useFlagReport(Number(id));
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [customFlyerError, setCustomFlyerError] = useState<string | null>(null);
  const flyerMutation = useMutation({
    mutationFn: () => getFlyer(Number(id)),
    onSuccess: (data) => setFlyerUrl(data.flyerUrl),
  });

  const handleCustomFlyerUpload = async (publicUrl: string) => {
    setCustomFlyerError(null);
    try {
      await uploadCustomFlyer(Number(id), publicUrl);
      setFlyerUrl(publicUrl);
    } catch {
      setCustomFlyerError("No se pudo guardar el flyer, intentá de nuevo.");
    }
  };

  const currentUserId = useAuthStore((state) => state.user?.id);

  // Punto de entrada al chat. Sin esto no hay forma de iniciar una conversación
  // desde la app: ChatList sólo muestra chats que ya existen en la base.
  // El chat es por reporte y POST /api/chats es idempotente: si ya existe el
  // chat de ESTE reporte con el autor, el backend responde 200 con ese mismo
  // chat. Por eso no hay fallback: cualquier error es un error real y se
  // muestra, nunca se abre un chat de otro reporte.
  const contactMutation = useMutation({
    mutationFn: async (ownerId: number) => {
      const chat = await createChat({ reportId: Number(id), participantId: ownerId });
      return chat.id;
    },
    onSuccess: (chatId) => navigate(`/chats/${chatId}`),
  });

  const shareFlyer = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: report?.title, url });
        return;
      } catch {
        // el usuario canceló el share nativo, no hace falta avisar nada
      }
    }
    await navigator.clipboard.writeText(url);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-muted">
        <Spinner size="lg" />
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const displayFlyerUrl = flyerUrl ?? report.customFlyerUrl;
  const isOwner = currentUserId === report.userId;
  // Solo un reporte publicado se cierra o se denuncia: pending todavía está en
  // moderación automática y rejected ya fue ocultado por un moderador; cerrarlo
  // lo pasaría a resolved y lo volvería a mostrar.
  const isPublished = report.status === "published";
  const canFlag = isPublished && currentUserId !== undefined && !isOwner;
  const canContact = currentUserId !== undefined && currentUserId !== report.userId;
  const canClose = isOwner && isPublished;
  const hasActions = canContact || canClose || canFlag;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-4 pt-2 sm:px-6 lg:py-6">
      <Link
        to="/reports"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 font-bold text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronLeftIcon className="h-5 w-5" />
        Volver
      </Link>

      {/* Una sola grilla: en mobile el panel de acciones queda último en el
          flujo y se pega abajo (sticky) sobre la tab bar; en desktop pasa a la
          columna derecha, arriba de las coincidencias. */}
      <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:grid-rows-[auto_1fr] lg:gap-8">
        <article className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="relative -mx-4 overflow-hidden bg-surface sm:mx-0 sm:rounded-card sm:border sm:border-line">
            {report.imageUrl ? (
              <img
                src={report.imageUrl}
                alt={report.title}
                width={1200}
                height={900}
                fetchPriority="high"
                className="aspect-[4/3] max-h-[70vh] w-full bg-surface object-cover"
              />
            ) : (
              <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 text-ink-muted">
                <PawIcon className="h-14 w-14" strokeWidth={1.5} />
                <span>Sin foto</span>
              </div>
            )}
            {report.tag && (
              <span
                className="tag-sticker absolute left-4 top-4 -rotate-3 px-4 py-2 text-base"
                style={{ backgroundColor: report.tag.color }}
              >
                {report.tag.label}
              </span>
            )}
          </div>

          <h1 className="mt-5 break-words font-display text-display-lg sm:text-display-xl">{report.title}</h1>

          <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
              <div className="min-w-0">
                <dt className="text-sm text-ink-muted">Ubicación</dt>
                <dd className="break-words font-bold text-ink">
                  {report.locationAddress || "Ubicación desconocida"}
                </dd>
                {report.location && (
                  <dd className="tabular text-sm text-ink-muted">
                    {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
                  </dd>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <CalendarIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
              <div>
                <dt className="text-sm text-ink-muted">Fecha</dt>
                <dd className="font-bold text-ink">{formatDate(report.createdAt)}</dd>
                {report.publishedAt && (
                  <dd className="text-sm text-ink-muted">Publicado: {formatDate(report.publishedAt)}</dd>
                )}
              </div>
            </div>
          </dl>

          {report.description && (
            <section className="mt-6">
              <h2 className={sectionTitle}>Descripción</h2>
              <p className="mt-2 max-w-prose whitespace-pre-wrap break-words text-ink">{report.description}</p>
            </section>
          )}

          <p className="mt-6 text-sm text-ink-muted">
            Estado: <span className="font-bold text-ink">{REPORT_STATUS_LABELS[report.status]}</span>
          </p>

          {report.status !== "pending" && (
            <section className="card mt-6 p-4 sm:p-5">
              <h2 className={sectionTitle}>Flyer para compartir</h2>
              {!displayFlyerUrl ? (
                <div className="mt-3 flex flex-col gap-3">
                  <Button
                    variant="secondary"
                    isLoading={flyerMutation.isPending}
                    onClick={() => flyerMutation.mutate()}
                    className="w-full sm:w-auto sm:self-start"
                  >
                    Generar flyer
                  </Button>
                  <p className="text-sm text-ink-muted">o subí tu propio flyer</p>
                  <ImageUploader
                    onSuccess={handleCustomFlyerUpload}
                    onError={(message, code) => {
                      // El uploader ya muestra el aviso de email sin verificar.
                      if (code !== EMAIL_NOT_VERIFIED) setCustomFlyerError(message);
                    }}
                  />
                  {customFlyerError && <ErrorMessage message={customFlyerError} />}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <img
                    src={displayFlyerUrl}
                    alt="Flyer del reporte"
                    width={160}
                    height={226}
                    loading="lazy"
                    className="w-40 rounded-control border border-line"
                  />
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <a
                      href={displayFlyerUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClasses("secondary")}
                    >
                      Descargar
                    </a>
                    <Button variant="primary" onClick={() => shareFlyer(displayFlyerUrl)}>
                      Compartir
                    </Button>
                  </div>
                </div>
              )}
              {flyerMutation.isError && (
                <ErrorMessage message="No se pudo generar el flyer, intentá de nuevo." className="mt-2" />
              )}
            </section>
          )}
        </article>

        <section className="min-w-0 lg:col-start-2 lg:row-start-2 lg:self-start" aria-labelledby="coincidencias">
          {report.status === "pending" ? (
            <PendingBanner />
          ) : (
            <>
              <h2 id="coincidencias" className={sectionTitle}>
                Coincidencias sugeridas
              </h2>
              <div className="mt-3">
                {isLoadingMatches ? (
                  <div className="flex justify-center py-4 text-ink-muted">
                    <Spinner size="sm" />
                  </div>
                ) : matches && matches.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1">
                    {matches.map((match) => (
                      <MatchCard
                        key={match.matchId}
                        match={match}
                        canManage={isOwner}
                        onConfirm={matchActions.confirm}
                        onReject={matchActions.reject}
                        isBusy={matchActions.isBusy}
                        error={matchActions.errorFor(match.matchId)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-card border border-dashed border-line p-4 text-sm text-ink-muted">
                    No se encontraron coincidencias todavía
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {hasActions && (
          <aside
            aria-label="Acciones del reporte"
            className={cn(
              "sticky bottom-above-tabbar z-20 -mx-4 flex max-h-[60vh] flex-col gap-2 overflow-y-auto overscroll-contain border-t border-line bg-paper px-4 py-3 shadow-sheet sm:-mx-6 sm:px-6",
              "lg:static lg:col-start-2 lg:row-start-1 lg:mx-0 lg:max-h-none lg:gap-3 lg:rounded-card lg:border lg:p-5 lg:shadow-none",
            )}
          >
            {canContact && (
              <div className="flex flex-col gap-2">
                <h2 className="sr-only font-display text-display-sm lg:not-sr-only">
                  ¿Tenés información sobre esta mascota?
                </h2>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={contactMutation.isPending}
                  onClick={() => contactMutation.mutate(report.userId)}
                >
                  {!contactMutation.isPending && <ChatIcon className="h-5 w-5" />}
                  Contactar al autor
                </Button>
                {contactMutation.isError &&
                  (getApiErrorCode(contactMutation.error) === EMAIL_NOT_VERIFIED ? (
                    <EmailNotVerifiedNotice />
                  ) : (
                    <ErrorMessage message="No se pudo abrir el chat, intentá de nuevo." />
                  ))}
              </div>
            )}

            {canClose && (
              <CloseReportButton
                onConfirm={closeReport.close}
                isPending={closeReport.isPending}
                error={closeReport.error}
              />
            )}

            {canFlag && (
              <FlagReportForm
                onSubmit={flagReport.flag}
                isPending={flagReport.isPending}
                isSent={flagReport.isSent}
                isDone={flagReport.isDone}
                error={flagReport.error}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
