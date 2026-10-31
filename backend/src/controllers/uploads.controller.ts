import { Request, Response } from "express";
import * as matchingService from "../services/matching.service";
import { LOW_QUALITY_IMAGE_MESSAGE, NO_ANIMAL_DETECTED_MESSAGE } from "../constants/moderation";
import * as storageService from "../services/storage.service";
import { analyzeImageSchema, presignUploadSchema } from "../validators/uploads.validator";

export async function presign(req: Request, res: Response): Promise<void> {
  const data = presignUploadSchema.parse(req.body);
  const result = await storageService.createPresignedUpload(data);
  res.status(201).json(result);
}

// `hasAnimal` is null when the AI service could not answer: the client lets the
// user continue and the report goes through the async moderation pipeline.
// A rejection carries the message to show, so its wording lives only here and in
// the 422 that create()/update() return for the same rule.
// `lowQuality` (#212) is only a warning: create()/update() never reject on it.
export async function analyze(req: Request, res: Response): Promise<void> {
  const { imageUrl } = analyzeImageSchema.parse(req.body);
  const result = await matchingService.analyzeImage(imageUrl);
  if (result === "no_animal") {
    res.status(200).json({ hasAnimal: false, message: NO_ANIMAL_DETECTED_MESSAGE, lowQuality: false });
    return;
  }
  if (result === "animal_low_quality") {
    res.status(200).json({ hasAnimal: true, lowQuality: true, qualityMessage: LOW_QUALITY_IMAGE_MESSAGE });
    return;
  }
  if (result === "unavailable") {
    res.status(200).json({ hasAnimal: null, lowQuality: null });
    return;
  }
  res.status(200).json({ hasAnimal: true, lowQuality: false });
}
