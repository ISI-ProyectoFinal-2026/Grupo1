import type { PetDTO } from "@/types/pet.types";
import { MAX_REPORT_PHOTOS } from "@/types/validators/report.validator";

export type PrefillField = "title" | "description";
export type Prefill = Partial<Record<PrefillField, string>> & {
  imageUrl?: string;
  extraImageUrls?: string[];
};

export const PREFILL_FIELDS: PrefillField[] = ["title", "description"];

const SPECIES_LABELS: Record<string, string> = { dog: "Perro", cat: "Gato", other: "Otra" };

// datos de la mascota propia para un reporte de pérdida (#255)
export function petPrefill(pet: PetDTO): Prefill {
  const kind = pet.breed ?? (pet.species ? SPECIES_LABELS[pet.species] : undefined);
  const title = pet.name ? (kind ? `${pet.name} (${kind})` : pet.name) : kind;
  return {
    title: title || undefined,
    description: pet.description || undefined,
    imageUrl: pet.photoUrls[0],
    extraImageUrls: pet.photoUrls.slice(1, MAX_REPORT_PHOTOS),
  };
}
