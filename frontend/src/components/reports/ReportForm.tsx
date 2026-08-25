import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createReportSchema, type CreateReportFormData } from "@/types/validators/report.validator";
import { createReport } from "@/services/reports.service";
import type { ReportLocation } from "@/types/report.types";
import Button from "@/components/ui/Button";
import InputBasic from "@/components/ui/InputBasic";
import ErrorMessage from "@/components/ui/ErrorMessage";
import ImageUploader from "./ImageUploader";
import LocationPicker from "./LocationPicker";

interface ReportFormProps {
  initialData?: Partial<CreateReportFormData>;
}

export default function ReportForm({ initialData }: ReportFormProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<Partial<CreateReportFormData>>({
    reportType: "lost",
    title: "",
    description: "",
    imageUrl: undefined,
    location: undefined,
    locationAddress: "",
    ...initialData,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleImageUploadSuccess = (publicUrl: string) => {
    setFormData((prev) => ({ ...prev, imageUrl: publicUrl }));
    setFormError(null);
  };

  const handleImageUploadError = (error: string) => {
    setFormError(error);
  };

  const handleLocationSelect = (location: ReportLocation, address: string) => {
    setFormData((prev) => ({
      ...prev,
      location,
      locationAddress: address,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const validated = createReportSchema.parse(formData);
      const result = await createReport(validated);

      navigate(`/reports/${result.id}`, {
        state: { message: "Reporte creado exitosamente" },
      });
    } catch (err: any) {
      if (err.errors) {
        const fieldErrs: Record<string, string> = {};
        err.errors.forEach((e: any) => {
          const path = e.path?.[0] || "general";
          fieldErrs[path] = e.message;
        });
        setFieldErrors(fieldErrs);
        setFormError("Por favor, corregí los errores del formulario");
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Error al crear el reporte");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {formError && <ErrorMessage message={formError} />}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-900">Tipo de reporte *</label>
        <select
          name="reportType"
          value={formData.reportType}
          onChange={handleInputChange}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="lost">🐾 Mascota Perdida</option>
          <option value="found">🔔 Mascota Encontrada</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium text-gray-900">
          Título *
        </label>
        <InputBasic
          id="title"
          name="title"
          type="text"
          placeholder="Ej: Gato gris perdido en San Telmo"
          value={formData.title || ""}
          onChange={handleInputChange}
          className={fieldErrors.title ? "border-red-500" : ""}
        />
        {fieldErrors.title && <ErrorMessage message={fieldErrors.title} />}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="text-sm font-medium text-gray-900">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          placeholder="Características adicionales, collar, señas particulares..."
          value={formData.description || ""}
          onChange={handleInputChange}
          rows={4}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-900">Foto *</label>
        <ImageUploader
          onSuccess={handleImageUploadSuccess}
          onError={handleImageUploadError}
        />
        {formData.imageUrl && (
          <p className="text-sm text-green-600">✓ Foto subida correctamente</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-900">Ubicación *</label>
        <LocationPicker onLocationSelect={handleLocationSelect} />
        {fieldErrors.location && <ErrorMessage message={fieldErrors.location} />}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isLoading}
        className="w-full"
      >
        Crear Reporte
      </Button>
    </form>
  );
}
