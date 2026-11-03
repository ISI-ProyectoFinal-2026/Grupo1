import { AppError } from "../errors/app-error";
import { NO_ANIMAL_DETECTED_MESSAGE } from "../constants/moderation";
import * as matchingService from "./matching.service";
import { isR2PublicUrl } from "./storage.service";

// screening de reportes y mascotas: solo bucket R2 (evita SSRF)
export async function assertImageHasAnimal(imageUrl: string): Promise<void> {
  if (isR2PublicUrl(imageUrl) && (await matchingService.analyzeImage(imageUrl)) === "no_animal") {
    throw new AppError(422, NO_ANIMAL_DETECTED_MESSAGE);
  }
}

export async function assertImagesHaveAnimals(imageUrls: string[]): Promise<void> {
  await Promise.all(imageUrls.map(assertImageHasAnimal));
}
