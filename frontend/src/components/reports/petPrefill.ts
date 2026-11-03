import type { PetDTO } from "@/types/pet.types";

export type PrefillField = "title" | "description" | "imageUrl";
export type Prefill = Partial<Record<PrefillField, string>>;

export const PREFILL_FIELDS: PrefillField[] = ["title", "description", "imageUrl"];

const SPECIES_LABELS: Record<string, string> = { dog: "Perro", cat: "Gato", other: "Otra" };

// datos de la mascota propia para un reporte de pérdida (#255)
export function petPrefill(pet: PetDTO): Prefill {
  const kind = pet.breed ?? (pet.species ? SPECIES_LABELS[pet.species] : undefined);
  const title = pet.name ? (kind ? `${pet.name} (${kind})` : pet.name) : kind;
  return {
    title: title || undefined,
    description: pet.description || undefined,
    imageUrl: pet.photoUrls[0],
  };
}
