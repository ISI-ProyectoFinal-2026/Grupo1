import { Link, useParams } from "react-router-dom";
import { useBusinessQuery, useContactBusinessMutation } from "@/hooks/useBusiness";
import type { BusinessCategory } from "@/types/business.types";

const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  VETERINARIA: "Veterinaria",
  REFUGIO: "Refugio",
  PET_SHOP: "Pet shop",
  OTRO: "Otro",
};

function BusinessProfilePage() {
  const { id } = useParams<{ id: string }>();
  const businessId = id ? Number(id) : undefined;

  // El GET del perfil registra la visita (evento VIEW) del lado del backend.
  const { data: business, isLoading, isError } = useBusinessQuery(businessId);
  const contactMutation = useContactBusinessMutation();

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Cargando comercio...</div>;
  }

  if (isError || !business) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-red-600">No se pudo cargar el comercio.</p>
        <Link to="/businesses" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← Volver al directorio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link to="/businesses" className="text-sm text-blue-600 hover:underline">
        ← Volver al directorio
      </Link>

      <div className="mt-4 rounded border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
        <p className="mt-1 text-sm text-gray-600">{CATEGORY_LABELS[business.category]}</p>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Domicilio</dt>
            <dd className="text-sm text-gray-900">{business.address}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Teléfono</dt>
            <dd className="text-sm text-gray-900">{business.phone}</dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-gray-200 pt-6">
          {contactMutation.isSuccess ? (
            <p className="text-sm text-green-600">
              ¡Listo! Registramos tu interés. Podés comunicarte al {business.phone}.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => contactMutation.mutate(business.id)}
              disabled={contactMutation.isPending}
              className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {contactMutation.isPending ? "Contactando..." : "Contactar"}
            </button>
          )}
          {contactMutation.isError && (
            <p className="mt-2 text-sm text-red-600">No se pudo registrar el contacto, intentá de nuevo.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default BusinessProfilePage;
