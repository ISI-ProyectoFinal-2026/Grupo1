import { useState, type ChangeEvent, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useUpload } from "@/hooks/useUpload";
import { useCreateReport } from "../hooks/useCreateReport";
import type { ReportType } from "@/types";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface FormErrors {
  title?: string;
  image?: string;
  submit?: string;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Tu navegador no soporta geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () =>
      reject(new Error("No pudimos acceder a tu ubicación. Habilitá el permiso e intentá de nuevo."))
    );
  });
}

function ReportForm() {
  const [reportType, setReportType] = useState<ReportType>("lost");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const { uploadFile, progress, isUploading } = useUpload();
  const { mutate: createReport, isPending } = useCreateReport();

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, image: "Formato no soportado. Usá JPEG, PNG o WEBP." }));
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({ ...prev, image: "La imagen no puede pesar más de 10 MB." }));
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    setErrors((prev) => ({ ...prev, image: undefined }));
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!title.trim()) nextErrors.title = "El título es obligatorio.";
    if (!imageFile) nextErrors.image = "Subí una foto de la mascota.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !imageFile) return;

    try {
      const position = await getCurrentPosition();
      const imageUrl = await uploadFile(imageFile);

      createReport(
        {
          reportType,
          title: title.trim(),
          description: description.trim() || undefined,
          imageUrl,
          locationAddress: locationAddress.trim() || undefined,
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        },
        {
          onError: (error) => {
            setErrors((prev) => ({ ...prev, submit: error.message }));
          },
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo publicar el reporte.";
      setErrors((prev) => ({ ...prev, submit: message }));
    }
  }

  const isSubmitting = isUploading || isPending;

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Tipo de reporte</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={reportType === "lost" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setReportType("lost")}
          >
            Perdido
          </Button>
          <Button
            type="button"
            variant={reportType === "found" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setReportType("found")}
          >
            Encontrado
          </Button>
        </div>
      </div>

      <Input
        label="Título"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={errors.title}
        placeholder="Ej: Golden perdido en Palermo"
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-gray-700">
          Descripción
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Color, collar, comportamiento, últimas señas..."
        />
      </div>

      <Input
        label="Zona"
        value={locationAddress}
        onChange={(event) => setLocationAddress(event.target.value)}
        hint="Ej: Palermo, cerca de Plaza Güemes"
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="image" className="text-sm font-medium text-gray-700">
          Foto
        </label>
        <input
          id="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
          className="text-sm text-gray-600"
        />
        {errors.image && <ErrorMessage message={errors.image} />}
        {imagePreview && <img src={imagePreview} alt="Vista previa" className="h-40 w-40 rounded-md object-cover" />}
        {isUploading && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {errors.submit && <ErrorMessage message={errors.submit} />}

      <Button type="submit" variant="primary" isLoading={isSubmitting}>
        Publicar reporte
      </Button>
    </form>
  );
}

export default ReportForm;
