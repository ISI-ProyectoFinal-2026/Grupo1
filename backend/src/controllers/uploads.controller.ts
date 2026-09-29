import { Request, Response } from "express";
import * as matchingService from "../services/matching.service";
import * as storageService from "../services/storage.service";
import { analyzeImageSchema, presignUploadSchema } from "../validators/uploads.validator";

export async function presign(req: Request, res: Response): Promise<void> {
  const data = presignUploadSchema.parse(req.body);
  const result = await storageService.createPresignedUpload(data);
  res.status(201).json(result);
}

// `hasAnimal` is null when the AI service could not answer: the client lets the
// user continue and the report goes through the async moderation pipeline.
export async function analyze(req: Request, res: Response): Promise<void> {
  const { imageUrl } = analyzeImageSchema.parse(req.body);
  const result = await matchingService.analyzeImage(imageUrl);
  res.status(200).json({ hasAnimal: result === "unavailable" ? null : result === "animal" });
}
