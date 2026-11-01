import { useState } from "react";
import type { FormEvent } from "react";
import ImageUploader from "@/components/reports/ImageUploader";
import Button from "@/components/ui/Button";
import ErrorMessage from "@/components/ui/ErrorMessage";
import {
  MAX_AD_BODY_LENGTH,
  MAX_AD_RADIUS_KM,
  MAX_AD_TITLE_LENGTH,
  MIN_AD_RADIUS_KM,
  type Ad,
  type AdInput,
} from "@/types/ad.types";

interface AdFormProps {
  // sin anuncio = alta
  ad?: Ad;
  isPending: boolean;
  onSubmit: (input: AdInput) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_RADIUS_KM = 5;

function AdForm({ ad, isPending, onSubmit, onCancel }: AdFormProps) {
  const [title, setTitle] = useState(ad?.title ?? "");
  const [body, setBody] = useState(ad?.body ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(ad?.imageUrl ?? null);
  const [radiusKm, setRadiusKm] = useState(String(ad?.radiusKm ?? DEFAULT_RADIUS_KM));
  const [isUploading, setIsUploading] = useState(false);
  const [isReplacingImage, setIsReplacingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!imageUrl) {
      setError("Subí una imagen para el anuncio");
      return;
    }
    try {
      await onSubmit({ title: title.trim(), body: body.trim(), imageUrl, radiusKm: Number(radiusKm) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el anuncio, intentá de nuevo");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-control bg-surface p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ad-title" className="field-label">
          Título
        </label>
        <input
          id="ad-title"
          type="text"
          required
          maxLength={MAX_AD_TITLE_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="field"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ad-body" className="field-label">
          Texto
        </label>
        <textarea
          id="ad-body"
          required
          rows={3}
          maxLength={MAX_AD_BODY_LENGTH}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="field"
        />
        <p className="text-sm text-ink-muted">
          {body.length}/{MAX_AD_BODY_LENGTH}
        </p>
      </div>

      {/* una sola área: la imagen actual, o el selector al subir o cambiarla */}
      <fieldset className="flex flex-col gap-2">
        <legend className="field-label mb-1.5">Imagen</legend>
        {imageUrl && !isReplacingImage ? (
          <>
            <img
              src={imageUrl}
              alt="Imagen del anuncio"
              className="aspect-video w-full rounded-control border border-line object-cover"
            />
            <Button variant="secondary" size="sm" onClick={() => setIsReplacingImage(true)}>
              Cambiar imagen
            </Button>
          </>
        ) : (
          <>
            <ImageUploader
              onSuccess={(publicUrl) => {
                setImageUrl(publicUrl);
                setIsReplacingImage(false);
              }}
              onError={(message) => setError(message)}
              onUploadingChange={setIsUploading}
            />
            {imageUrl && (
              <Button variant="ghost" size="sm" disabled={isUploading} onClick={() => setIsReplacingImage(false)}>
                Conservar la imagen actual
              </Button>
            )}
          </>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ad-radius" className="field-label">
          Radio de alcance (km)
        </label>
        <input
          id="ad-radius"
          type="number"
          inputMode="numeric"
          required
          min={MIN_AD_RADIUS_KM}
          max={MAX_AD_RADIUS_KM}
          step={1}
          value={radiusKm}
          onChange={(event) => setRadiusKm(event.target.value)}
          className="field"
        />
        <p className="text-sm text-ink-muted">
          Se muestra a quienes estén a hasta esa distancia de tu comercio ({MIN_AD_RADIUS_KM} a {MAX_AD_RADIUS_KM} km).
        </p>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" variant="primary" isLoading={isPending} disabled={isUploading}>
          {ad ? "Guardar anuncio" : "Publicar anuncio"}
        </Button>
        <Button variant="secondary" disabled={isPending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export default AdForm;
