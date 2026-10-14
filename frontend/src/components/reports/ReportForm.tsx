import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ZodError } from "zod";
import { createReportSchema, type CreateReportFormData } from "@/types/validators/report.validator";
import { createReport } from "@/services/reports.service";
import type { ReportLocation } from "@/types/report.types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ErrorMessage from "@/components/ui/ErrorMessage";
import ActionErrorMessage from "@/components/auth/ActionErrorMessage";
import { getApiErrorCode } from "@/services/api";
import { EMAIL_NOT_VERIFIED } from "@/types/auth";
import ImageUploader from "./ImageUploader";
import LocationPicker from "./LocationPicker";

interface ReportFormProps {
  initialData?: Partial<CreateReportFormData>;
}

export default function ReportForm({ initialData }: ReportFormProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Set when the screening found no animal in the uploaded photo: the report
  // cannot be submitted until the user uploads a different one.
  const [imageRejection, setImageRejection] = useState<string | null>(null);
  // While the photo uploads and is analyzed there is no imageUrl nor verdict yet:
  // submitting then would create the report without image, skipping the screening.
  const [isImageUploading, setIsImageUploading] = useState(false);
  const canSubmit = !imageRejection && !isImageUploading;

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

  const handleImageUploadSuccess = (publicUrl: string, rejection: string | null) => {
    setFormData((prev) => ({ ...prev, imageUrl: publicUrl }));
    setImageRejection(rejection);
    setFormError(null);
  };

  const handleImageUploadError = (error: string, code?: string) => {
    // El uploader ya muestra el aviso de email sin verificar junto a la foto.
    if (code === EMAIL_NOT_VERIFIED) return;
    setFormError(error);
    setFormErrorCode(null);
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
    if (!canSubmit) return;
    setFormError(null);
    setFormErrorCode(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const validated = createReportSchema.parse(formData);
      const result = await createReport(validated);

      navigate(`/reports/${result.id}`, {
        state: { message: "Reporte creado exitosamente" },
      });
    } catch (err) {
      // Zod 4 expone las incidencias en `issues`; `errors` era la propiedad de
      // v3 y hoy es undefined, así que un formulario inválido caía al branch
      // genérico y le mostraba al usuario el JSON crudo del ZodError.
      if (err instanceof ZodError) {
        const fieldErrs: Record<string, string> = {};
        for (const issue of err.issues) {
          const path = String(issue.path[0] ?? "general");
          fieldErrs[path] = issue.message;
        }
        setFieldErrors(fieldErrs);
        setFormError("Por favor, corregí los errores del formulario");
      } else if (err instanceof Error) {
        setFormError(err.message);
        setFormErrorCode(getApiErrorCode(err) ?? null);
      } else {
        setFormError("Error al crear el reporte");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {formError && <ActionErrorMessage message={formError} code={formErrorCode} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reportType" className="field-label">
          Tipo de reporte *
        </label>
        <select
          id="reportType"
          name="reportType"
          value={formData.reportType}
          onChange={handleInputChange}
          className="field"
        >
          <option value="lost">Mascota Perdida</option>
          <option value="found">Mascota Encontrada</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Input
          label="Título *"
          id="title"
          name="title"
          type="text"
          autoComplete="off"
          placeholder="Ej: Gato gris perdido en San Telmo…"
          value={formData.title || ""}
          onChange={handleInputChange}
          aria-invalid={Boolean(fieldErrors.title)}
        />
        {fieldErrors.title && <ErrorMessage message={fieldErrors.title} />}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="field-label">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          placeholder="Características adicionales, collar, señas particulares…"
          value={formData.description || ""}
          onChange={handleInputChange}
          rows={4}
          className="field resize-y"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label mb-1.5">Foto *</legend>
        <ImageUploader
          onSuccess={handleImageUploadSuccess}
          onError={handleImageUploadError}
          onUploadingChange={setIsImageUploading}
          screenForAnimals
        />
        {imageRejection ? (
          <ErrorMessage message={imageRejection} />
        ) : (
          formData.imageUrl && (
            <div className="flex items-center gap-3">
              <img
                src={formData.imageUrl}
                alt="Foto subida"
                className="size-20 shrink-0 rounded-control border border-line object-cover"
              />
              <p className="text-sm font-bold text-success-ink">✓ Foto subida correctamente</p>
            </div>
          )
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label mb-1.5">Ubicación *</legend>
        <LocationPicker onLocationSelect={handleLocationSelect} />
        {fieldErrors.location && <ErrorMessage message={fieldErrors.location} />}
      </fieldset>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isLoading}
        disabled={!canSubmit}
        className="w-full"
      >
        Crear Reporte
      </Button>
    </form>
  );
}
