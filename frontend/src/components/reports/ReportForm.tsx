import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ZodError } from "zod";
import {
  createReportSchema,
  newReportSchema,
  type CreateReportFormData,
} from "@/types/validators/report.validator";
import { createReport } from "@/services/reports.service";
import PetSelect from "./PetSelect";
import ReportTypeBadge from "./ReportTypeBadge";
import { PREFILL_FIELDS, petPrefill, type Prefill } from "./petPrefill";
import type { PetDTO } from "@/types/pet.types";
import { screenImage } from "@/lib/screen-image";
import { useAuthStore } from "@/stores/auth.store";
import { todayInArgentina } from "@/lib/format";
import type { ReportLocation } from "@/types/report.types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { CheckIcon } from "@/components/ui/icons";
import ActionErrorMessage from "@/components/auth/ActionErrorMessage";
import { getApiErrorCode } from "@/services/api";
import { EMAIL_NOT_VERIFIED } from "@/types/auth";
import ImageUploader from "./ImageUploader";
import SimilarReportsSuggestions from "./SimilarReportsSuggestions";
import LocationPicker from "@/components/maps/LocationPicker";

// "create" posts a new report and opens it. "edit" hands the validated data to
// the caller, which owns the PUT and the navigation afterwards.
type ReportFormProps =
  | { mode?: "create"; initialData?: Partial<CreateReportFormData> }
  | {
      mode: "edit";
      initialData: Partial<CreateReportFormData>;
      onSubmit: (data: CreateReportFormData) => Promise<void>;
      // The backend rejects a new photo on a resolved report (409).
      canChangeImage?: boolean;
    };

export default function ReportForm(props: ReportFormProps) {
  const { initialData } = props;
  const isEdit = props.mode === "edit";
  const canChangeImage = props.mode !== "edit" || props.canChangeImage !== false;
  const navigate = useNavigate();
  const hasPhone = Boolean(useAuthStore((state) => state.user?.phone));
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Set when the screening found no animal in the uploaded photo: the report
  // cannot be submitted until the user uploads a different one.
  const [imageRejection, setImageRejection] = useState<string | null>(null);
  // Blurry or moved photo (#212): only a warning, the report can still be sent.
  const [imageQualityWarning, setImageQualityWarning] = useState<string | null>(null);
  // While the photo uploads and is analyzed there is no imageUrl nor verdict yet:
  // submitting then would create the report without image, skipping the screening.
  const [isImageUploading, setIsImageUploading] = useState(false);
  // valores precargados desde la mascota propia (#255)
  const [prefilled, setPrefilled] = useState<Prefill>({});
  const [isPrefillScreening, setIsPrefillScreening] = useState(false);
  const prefillScreeningUrl = useRef<string | null>(null);
  const canSubmit = !imageRejection && !isImageUploading && !isPrefillScreening;

  const [formData, setFormData] = useState<Partial<CreateReportFormData>>({
    reportType: "lost",
    title: "",
    description: "",
    imageUrl: undefined,
    location: undefined,
    locationAddress: "",
    // editar no inventa la fecha de un reporte anterior
    eventDate: isEdit ? undefined : todayInArgentina(),
    ...initialData,
  });

  // In edit mode the photo already saved is shown as such, not as a new upload.
  const isCurrentImage = isEdit && formData.imageUrl === initialData?.imageUrl;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleImageUploadSuccess = (
    publicUrl: string,
    rejection: string | null,
    qualityWarning: string | null
  ) => {
    setFormData((prev) => ({ ...prev, imageUrl: publicUrl }));
    prefillScreeningUrl.current = null;
    setIsPrefillScreening(false);
    setImageRejection(rejection);
    setImageQualityWarning(qualityWarning);
    setFormError(null);
    setFieldErrors((prev) => ({ ...prev, imageUrl: "" }));
  };

  const handleImageUploadError = (error: string, code?: string) => {
    // El uploader ya muestra el aviso de email sin verificar junto a la foto.
    if (code === EMAIL_NOT_VERIFIED) return;
    setFormError(error);
    setFormErrorCode(null);
  };

  // foto precargada: misma verificación que una subida (#255)
  const screenPrefilledImage = async (url: string) => {
    prefillScreeningUrl.current = url;
    setIsPrefillScreening(true);
    const { rejection, qualityWarning } = await screenImage(url);
    if (prefillScreeningUrl.current !== url) return;
    prefillScreeningUrl.current = null;
    setImageRejection(rejection);
    setImageQualityWarning(qualityWarning);
    setIsPrefillScreening(false);
  };

  // solo se pisan campos vacíos o que siguen con el valor precargado (#255)
  const handlePetChange = (petId: number | undefined, pet?: PetDTO) => {
    const next = pet && !isEdit && formData.reportType === "lost" ? petPrefill(pet) : {};
    const updated: Partial<CreateReportFormData> = { ...formData, petId };
    const applied: Prefill = {};
    for (const field of PREFILL_FIELDS) {
      const current = formData[field] ?? "";
      if (current !== "" && current !== prefilled[field]) continue;
      const value = next[field];
      if (value) {
        updated[field] = value;
        applied[field] = value;
      } else if (current !== "") {
        updated[field] = field === "imageUrl" ? undefined : "";
      }
    }
    setFormData(updated);
    setPrefilled(applied);

    if (updated.imageUrl !== formData.imageUrl) {
      prefillScreeningUrl.current = null;
      setIsPrefillScreening(false);
      setImageRejection(null);
      setImageQualityWarning(null);
      if (applied.imageUrl) void screenPrefilledImage(applied.imageUrl);
    }
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
      if (props.mode === "edit") {
        await props.onSubmit(createReportSchema.parse(formData));
        return;
      }
      const result = await createReport(newReportSchema.parse(formData));

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
        setFormError(isEdit ? "Error al guardar los cambios" : "Error al crear el reporte");
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
        <div className="flex items-center gap-3">
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
          <ReportTypeBadge reportType={formData.reportType ?? "lost"} className="shrink-0" />
        </div>
      </div>

      <PetSelect
        value={formData.petId}
        onChange={handlePetChange}
      />

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

      <div className="flex flex-col gap-2">
        <Input
          label="Fecha del suceso *"
          id="eventDate"
          name="eventDate"
          type="date"
          max={todayInArgentina()}
          value={formData.eventDate || ""}
          onChange={handleInputChange}
          aria-invalid={Boolean(fieldErrors.eventDate)}
        />
        {fieldErrors.eventDate && <ErrorMessage message={fieldErrors.eventDate} />}
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
        {canChangeImage ? (
          <ImageUploader
            onSuccess={handleImageUploadSuccess}
            onError={handleImageUploadError}
            onUploadingChange={setIsImageUploading}
            screenForAnimals
          />
        ) : (
          <p className="text-sm text-ink-muted">La foto de un reporte resuelto no se puede cambiar.</p>
        )}
        {isEdit && canChangeImage && (
          <p className="text-sm text-ink-muted">
            Si cambiás la foto, el reporte vuelve a revisión y no se muestra hasta que se apruebe.
          </p>
        )}
        {imageRejection ? (
          <ErrorMessage message={imageRejection} />
        ) : fieldErrors.imageUrl ? (
          <ErrorMessage message={fieldErrors.imageUrl} />
        ) : (
          formData.imageUrl &&
          (formData.imageUrl === prefilled.imageUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={formData.imageUrl}
                alt="Foto de tu mascota"
                className="size-20 shrink-0 rounded-control border border-line object-cover"
              />
              <p className="text-sm text-ink-muted">
                Usamos la primera foto de tu mascota. Podés cambiarla subiendo otra.
              </p>
            </div>
          ) : isCurrentImage ? (
            <img
              src={formData.imageUrl}
              alt="Foto actual"
              className="size-20 shrink-0 rounded-control border border-line object-cover"
            />
          ) : (
            <div className="flex items-center gap-3">
              <img
                src={formData.imageUrl}
                alt="Foto subida"
                className="size-20 shrink-0 rounded-control border border-line object-cover"
              />
              <p className="flex items-center gap-1.5 text-sm font-bold text-success-ink">
                <CheckIcon className="h-4 w-4 shrink-0" />
                Foto subida correctamente
              </p>
            </div>
          ))
        )}
        {!imageRejection && imageQualityWarning && (
          <p
            role="status"
            className="animate-drop rounded-control border border-signal bg-signal/15 px-3 py-2.5 text-sm text-ink"
          >
            {imageQualityWarning}
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label mb-1.5">Ubicación *</legend>
        <LocationPicker
          onLocationSelect={handleLocationSelect}
          initialLocation={initialData?.location}
          initialAddress={initialData?.locationAddress}
        />
        {fieldErrors.location && <ErrorMessage message={fieldErrors.location} />}
        {/* edit: the report already exists and would be suggested as its own duplicate */}
        {!isEdit && (
          <SimilarReportsSuggestions
            reportType={formData.reportType ?? "lost"}
            location={formData.location}
            imageUrl={imageRejection ? undefined : formData.imageUrl}
          />
        )}
      </fieldset>

      {/* el flyer es público: el teléfono va solo con consentimiento (#259) */}
      {hasPhone && (
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="showPhoneOnFlyer"
            checked={formData.showPhoneOnFlyer ?? false}
            onChange={(e) => setFormData((prev) => ({ ...prev, showPhoneOnFlyer: e.target.checked }))}
            className="mt-0.5 size-4 shrink-0 accent-ink"
          />
          <span>
            Mostrar mi teléfono en el flyer
            <span className="block text-ink-muted">
              El flyer es público: cualquiera que lo vea va a poder llamarte.
            </span>
          </span>
        </label>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isLoading}
        disabled={!canSubmit}
        className="w-full"
      >
        {isEdit ? "Guardar cambios" : "Crear Reporte"}
      </Button>
    </form>
  );
}
