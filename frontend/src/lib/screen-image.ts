import { analyzeImage } from "@/services/uploads.service";

export interface Screening {
  rejection: string | null;
  qualityWarning: string | null;
}

export const NO_SCREENING: Screening = { rejection: null, qualityWarning: null };

// Best-effort: the upload itself already succeeded, so a failed analysis is an
// unknown verdict (no rejection) rather than an upload error. The backend
// re-checks the image when the report is created anyway.
export async function screenImage(publicUrl: string): Promise<Screening> {
  try {
    const analysis = await analyzeImage(publicUrl);
    return {
      rejection: analysis.hasAnimal === false ? analysis.message : null,
      qualityWarning: analysis.lowQuality === true ? analysis.qualityMessage : null,
    };
  } catch {
    return NO_SCREENING;
  }
}
