import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ZodError } from "zod";
import {
  MAX_REPORT_PHOTOS,
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
import ActionErrorMessage from "@/components/auth/ActionErrorMessage";
import { getApiErrorCode } from "@/services/api";
import MultiImageUploader from "@/components/common/MultiImageUploader";
import SimilarReportsSuggestions from "./SimilarReportsSuggestions";
import LocationPicker from "@/components/maps/LocationPicker";

interface PhotoNotice {
  url: string;
  message: string;
}

function toPhotoList(imageUrl?: string, extraImageUrls?: string[]): string[] {
  return imageUrl ? [imageUrl, ...(extraImageUrls ?? [])] : [];
}

function prefilledPhotos(prefill: Prefill): string[] {
  return toPhotoList(prefill.imageUrl, prefill.extraImageUrls);
}

function samePhotos(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((url, index) => url === b[index]);
}

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
  // While the photos upload and are analyzed there is no verdict yet:
  // submitting then would create the report skipping the screening.
  const [isImageUploading, setIsImageUploading] = useState(false);
  // valores precargados desde la mascota propia (#255)
  const [prefilled, setPrefilled] = useState<Prefill>({});
  const [isPrefillScreening, setIsPrefillScreening] = useState(false);
  const prefillScreeningToken = useRef(0);
  // veredicto de las fotos precargadas: la subida ya filtra las propias
  const [prefillRejection, setPrefillRejection] = useState<PhotoNotice | null>(null);
  const [prefillQualityWarning, setPrefillQualityWarning] = useState<PhotoNotice | null>(null);

  const [formData, setFormData] = useState<Partial<CreateReportFormData>>({
    reportType: "lost",
    title: "",
    description: "",
    imageUrl: undefined,
    extraImageUrls: [],
    location: undefined,
    locationAddress: "",
    // editar no inventa la fecha de un reporte anterior
    eventDate: isEdit ? undefined : todayInArgentina(),
    ...initialData,
  });

  // la principal va primero; el resto son fotos extra
  const photos = toPhotoList(formData.imageUrl, formData.extraImageUrls);
  const imageRejection =
    prefillRejection && photos.includes(prefillRejection.url) ? prefillRejection.message : null;
  const imageQualityWarning =
    prefillQualityWarning && photos.includes(prefillQualityWarning.url) ? prefillQualityWarning.message : null;
  const canSubmit = !imageRejection && !isImageUploading && !isPrefillScreening;
  const usesPetPhotos = Boolean(prefilled.imageUrl) && samePhotos(photos, prefilledPhotos(prefilled));

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handlePhotosChange = (urls: string[]) => {
    setFormData((prev) => ({ ...prev, imageUrl: urls[0], extraImageUrls: urls.slice(1) }));
    if (urls.length > 0) setFieldErrors((prev) => ({ ...prev, imageUrl: "" }));
  };

  // fotos precargadas: misma verificación que una subida (#255)
  const screenPrefilledImages = async (urls: string[]) => {
    const token = ++prefillScreeningToken.current;
    setIsPrefillScreening(true);
    const results = await Promise.all(urls.map(async (url) => ({ url, ...(await screenImage(url)) })));
    if (prefillScreeningToken.current !== token) return;
    const rejected = results.find((result) => result.rejection);
    const blurry = results.find((result) => result.qualityWarning);
    setPrefillRejection(rejected ? { url: rejected.url, message: rejected.rejection! } : null);
    setPrefillQualityWarning(blurry ? { url: blurry.url, message: blurry.qualityWarning! } : null);
    setIsPrefillScreening(false);
  };

  const resetPrefillScreening = () => {
    prefillScreeningToken.current += 1;
    setIsPrefillScreening(false);
    setPrefillRejection(null);
    setPrefillQualityWarning(null);
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
        updated[field] = "";
      }
    }
    // las fotos se pisan solo si no hay o siguen siendo las precargadas
    const canReplacePhotos = photos.length === 0 || usesPetPhotos;
    const nextPhotos = prefilledPhotos(next);
    if (canReplacePhotos) {
      updated.imageUrl = nextPhotos[0];
      updated.extraImageUrls = nextPhotos.slice(1);
      if (nextPhotos.length > 0) {
        applied.imageUrl = next.imageUrl;
        applied.extraImageUrls = next.extraImageUrls;
      }
    }
    setFormData(updated);
    setPrefilled(applied);

    if (canReplacePhotos && !samePhotos(nextPhotos, photos)) {
      resetPrefillScreening();
      if (nextPhotos.length > 0) void screenPrefilledImages(nextPhotos);
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
        <legend className="field-label mb-1.5">Fotos *</legend>
        {canChangeImage ? (
          <MultiImageUploader
            value={photos}
            onChange={handlePhotosChange}
            max={MAX_REPORT_PHOTOS}
            onUploadingChange={setIsImageUploading}
            screenForAnimals
          />
        ) : (
          <>
            {photos.length > 0 && (
              <ul className="flex flex-wrap gap-3">
                {photos.map((url, index) => (
                  <li key={url}>
                    <img
                      src={url}
                      alt={`Foto ${index + 1}`}
                      className="size-20 rounded-control border border-line object-cover"
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-ink-muted">Las fotos de un reporte resuelto no se pueden cambiar.</p>
          </>
        )}
        {usesPetPhotos && (
          <p className="text-sm text-ink-muted">
            Usamos las fotos de tu mascota. Podés quitarlas o subir otras.
          </p>
        )}
        {isEdit && canChangeImage && (
          <p className="text-sm text-ink-muted">
            Si cambiás las fotos, el reporte vuelve a revisión y no se muestra hasta que se apruebe.
          </p>
        )}
        {imageRejection ? (
          <ErrorMessage message={imageRejection} />
        ) : (
          fieldErrors.imageUrl && <ErrorMessage message={fieldErrors.imageUrl} />
        )}
        {fieldErrors.extraImageUrls && <ErrorMessage message={fieldErrors.extraImageUrls} />}
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
