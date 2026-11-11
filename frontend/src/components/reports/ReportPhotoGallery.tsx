import { useState } from "react";
import { cn } from "@/lib/cn";

interface ReportPhotoGalleryProps {
  mainUrl: string;
  extraUrls?: string[];
  alt: string;
}

// foto principal + miniaturas de las extra
export default function ReportPhotoGallery({ mainUrl, extraUrls = [], alt }: ReportPhotoGalleryProps) {
  const photos = [mainUrl, ...extraUrls];
  const [selected, setSelected] = useState(0);
  const current = Math.min(selected, photos.length - 1);
  const hasGallery = photos.length > 1;

  return (
    <>
      <img
        src={photos[current]}
        alt={hasGallery && current > 0 ? `${alt} (foto ${current + 1} de ${photos.length})` : alt}
        width={1200}
        height={900}
        fetchPriority="high"
        className="aspect-[4/3] max-h-[70vh] w-full bg-surface object-cover"
      />
      {hasGallery && (
        <ul className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-3">
          {photos.map((url, index) => (
            <li key={`${url}-${index}`} className="shrink-0">
              <button
                type="button"
                aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                aria-pressed={index === current}
                onClick={() => setSelected(index)}
                className={cn(
                  "press block overflow-hidden rounded-control border-2 transition-[border-color,opacity] duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
                  index === current ? "border-ink" : "border-line opacity-70 hover:opacity-100"
                )}
              >
                <img src={url} alt="" loading="lazy" className="size-14 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
