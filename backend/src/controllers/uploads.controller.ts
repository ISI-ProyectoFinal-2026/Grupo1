import { Request, Response } from "express";
import * as storageService from "../services/storage.service";
import { presignUploadSchema } from "../validators/uploads.validator";

export async function presign(req: Request, res: Response): Promise<void> {
  const data = presignUploadSchema.parse(req.body);
  const result = await storageService.createPresignedUpload(data);
  res.status(201).json(result);
}
