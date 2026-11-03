import { AppError } from "../errors/app-error";

// Politica de uso de Nominatim: maximo 1 solicitud por segundo por aplicacion
// y User-Agent que identifique la app (ADR-0025, #216).
export const REVERSE_GEOCODE_MIN_INTERVAL_MS = 1100;
export const REVERSE_GEOCODE_MAX_QUEUE = 5;
// 3 decimales ~ 110 m: alcanza para ciudad/localidad y agrupa pedidos cercanos
const COORD_DECIMALS = 3;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;
const REQUEST_TIMEOUT_MS = 5000;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const DEFAULT_USER_AGENT = "Patitas/1.0 (UTN FRSR - Proyecto Final)";

interface ReverseGeocoderOptions {
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
}

interface CacheEntry {
  address: string | null;
  expiresAt: number;
}

const roundCoord = (value: number) => value.toFixed(COORD_DECIMALS);

export function createReverseGeocoder(options: ReverseGeocoderOptions = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const userAgent = options.userAgent ?? process.env.NOMINATIM_USER_AGENT ?? DEFAULT_USER_AGENT;

  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<string | null>>();
  let tail: Promise<void> = Promise.resolve();
  let waiting = 0;
  let lastCallAt = 0;

  function cacheGet(key: string): CacheEntry | undefined {
    const entry = cache.get(key);
    if (entry && entry.expiresAt > now()) return entry;
    cache.delete(key);
    return undefined;
  }

  function cacheSet(key: string, address: string | null): void {
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { address, expiresAt: now() + CACHE_TTL_MS });
  }

  // Cola global: una llamada a la vez, separadas por el intervalo minimo
  async function throttled<T>(task: () => Promise<T>): Promise<T> {
    if (waiting >= REVERSE_GEOCODE_MAX_QUEUE) {
      throw new AppError(503, "Servicio de geocodificación ocupado, intentá de nuevo en unos segundos");
    }
    waiting++;
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await previous;
      const wait = lastCallAt + REVERSE_GEOCODE_MIN_INTERVAL_MS - now();
      if (wait > 0) await sleep(wait);
      lastCallAt = now();
      return await task();
    } finally {
      waiting--;
      release();
    }
  }

  async function callNominatim(lat: string, lng: string): Promise<string | null> {
    let response: Response;
    try {
      response = await fetchFn(`${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lng}`, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new AppError(502, "No se pudo consultar el servicio de geocodificación");
    }
    if (!response.ok) {
      throw new AppError(502, `El servicio de geocodificación respondió ${response.status}`);
    }
    const data = (await response.json()) as { address?: { city?: string; town?: string } };
    return data.address?.city || data.address?.town || null;
  }

  async function reverse(lat: number, lng: number): Promise<string | null> {
    const latKey = roundCoord(lat);
    const lngKey = roundCoord(lng);
    const key = `${latKey},${lngKey}`;

    const cached = cacheGet(key);
    if (cached) return cached.address;

    const pending = inflight.get(key);
    if (pending) return pending;

    const request = throttled(() => callNominatim(latKey, lngKey))
      .then((address) => {
        cacheSet(key, address);
        return address;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  }

  return { reverse };
}

export const reverseGeocoder = createReverseGeocoder();
