import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useReportDetailQuery } from "@/hooks/useReportDetailQuery";
import { useReportMatchesQuery } from "@/hooks/useReportMatchesQuery";
import { getFlyer } from "@/services/reports.service";
import { createChat, listChats } from "@/services/chats.service";
import { useAuthStore } from "@/stores/auth.store";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import PendingBanner from "@/components/reports/PendingBanner";
import MatchCard from "@/components/reports/MatchCard";

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: report, isLoading, error } = useReportDetailQuery(id ? Number(id) : undefined);
  const { data: matches, isLoading: isLoadingMatches } = useReportMatchesQuery(
    id ? Number(id) : undefined,
    report?.status,
  );
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const flyerMutation = useMutation({
    mutationFn: () => getFlyer(Number(id)),
    onSuccess: (data) => setFlyerUrl(data.flyerUrl),
  });

  const currentUserId = useAuthStore((state) => state.user?.id);

  // Punto de entrada al chat. Sin esto no hay forma de iniciar una conversación
  // desde la app: ChatList sólo muestra chats que ya existen en la base.
  const contactMutation = useMutation({
    mutationFn: async (ownerId: number) => {
      try {
        const chat = await createChat({ reportId: Number(id), participantId: ownerId });
        return chat.id;
      } catch (createError) {
        // El backend responde 409 si ya existe un chat con ese participante: el
        // par de usuarios es único y no distingue por reporte (schema.prisma,
        // @@unique([userAId, userBId])). En ese caso el chat ya está, hay que
        // encontrarlo para poder abrirlo en vez de dejar al usuario trabado.
        const chats = await listChats();
        const existing = chats.find(
          (chat) => chat.userAId === ownerId || chat.userBId === ownerId,
        );
        if (!existing) throw createError;
        return existing.id;
      }
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
      <div className="flex justify-center items-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error al cargar el reporte
        </div>
        <Button
          variant="secondary"
          onClick={() => navigate("/reports")}
          className="mt-4"
        >
          Volver a reportes
        </Button>
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

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Button
        variant="secondary"
        onClick={() => navigate("/reports")}
        className="mb-6"
      >
        ← Volver
      </Button>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {report.imageUrl && (
          <img
            src={report.imageUrl}
            alt={report.title}
            className="w-full h-96 object-cover"
          />
        )}

        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {report.title}
              </h1>
              {report.tag && (
                <span
                  className="inline-block px-4 py-1 rounded-full text-white text-sm font-semibold"
                  style={{ backgroundColor: report.tag.color }}
                >
                  {report.tag.label}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Ubicación
              </h3>
              <p className="text-lg text-gray-900">
                {report.locationAddress || "Ubicación desconocida"}
              </p>
              {report.location && (
                <p className="text-sm text-gray-500">
                  {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Fecha</h3>
              <p className="text-lg text-gray-900">
                {formatDate(report.createdAt)}
              </p>
              {report.publishedAt && (
                <p className="text-sm text-gray-500">
                  Publicado: {formatDate(report.publishedAt)}
                </p>
              )}
            </div>
          </div>

          {report.description && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Descripción
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {report.description}
              </p>
            </div>
          )}

          {report.status !== "pending" && (
            <div className="border-t pt-6 mb-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Flyer para compartir
              </h3>
              {!flyerUrl ? (
                <Button
                  variant="secondary"
                  isLoading={flyerMutation.isPending}
                  onClick={() => flyerMutation.mutate()}
                >
                  Generar flyer
                </Button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <img src={flyerUrl} alt="Flyer del reporte" className="w-40 rounded-md shadow" />
                  <div className="flex gap-3">
                    <a href={flyerUrl} download target="_blank" rel="noreferrer">
                      <Button variant="secondary">Descargar</Button>
                    </a>
                    <Button variant="primary" onClick={() => shareFlyer(flyerUrl)}>
                      Compartir
                    </Button>
                  </div>
                </div>
              )}
              {flyerMutation.isError && (
                <p className="text-sm text-red-600 mt-2">No se pudo generar el flyer, intentá de nuevo.</p>
              )}
            </div>
          )}

          {currentUserId !== undefined && currentUserId !== report.userId && (
            <div className="border-t pt-6 mb-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                ¿Tenés información sobre esta mascota?
              </h3>
              <Button
                variant="primary"
                isLoading={contactMutation.isPending}
                onClick={() => contactMutation.mutate(report.userId)}
              >
                Contactar al autor
              </Button>
              {contactMutation.isError && (
                <p className="text-sm text-red-600 mt-2">
                  No se pudo abrir el chat, intentá de nuevo.
                </p>
              )}
            </div>
          )}

          <div className="border-t pt-6">
            <p className="text-sm text-gray-500">
              Estado: <span className="font-semibold text-gray-900">{report.status}</span>
            </p>
          </div>

          <div className="border-t pt-6 mt-6">
            {report.status === "pending" ? (
              <PendingBanner />
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Coincidencias sugeridas
                </h3>
                {isLoadingMatches ? (
                  <div className="flex justify-center py-4">
                    <Spinner size="sm" />
                  </div>
                ) : matches && matches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matches.map((match) => (
                      <MatchCard key={match.reportId} match={match} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No se encontraron coincidencias todavía</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
