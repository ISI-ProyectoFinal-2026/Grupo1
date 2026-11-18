import type { StoredObject } from "./ports";

export const IMAGES_PREFIX = "images/";

export interface CopyItem {
  sourceKey: string;
  destKey: string;
}

function normalizeEtag(etag: string): string {
  return etag.replace(/"/g, "").toLowerCase();
}

// copia incremental: faltantes o distintos (tamaño/ETag); nunca propone borrar
export function selectImagesToCopy(source: StoredObject[], backup: StoredObject[]): CopyItem[] {
  const existing = new Map(backup.map((object) => [object.key, object]));
  return source
    .filter((object) => !object.key.endsWith("/"))
    .filter((object) => {
      const copy = existing.get(IMAGES_PREFIX + object.key);
      return (
        !copy || copy.size !== object.size || normalizeEtag(copy.etag) !== normalizeEtag(object.etag)
      );
    })
    .map((object) => ({ sourceKey: object.key, destKey: IMAGES_PREFIX + object.key }));
}
