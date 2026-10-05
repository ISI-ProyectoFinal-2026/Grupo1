/**
 * Stub del Backend IA sobre `global.fetch`. Node solo habla con el Backend IA
 * por fetch (supertest usa http directo, así que no se ve afectado), y enruta
 * por URL:
 * - `POST /images/analyze`: screening sincrónico (matching.service#analyzeImage).
 *   200 + `{ has_animal }` es veredicto; cualquier otra cosa es "unavailable".
 * - `POST /reports/:id/embedding`: moderación asíncrona
 *   (matching.service#triggerEmbeddingGeneration). 201 -> published,
 *   422 -> rejected, 5xx/red -> reintentos con delays de 1s/5s/30s.
 *
 * Ojo con los 5xx o `networkError` en embedding: disparan esos reintentos con
 * setTimeout reales y dejan la suite esperando. Para el camino feliz, 201.
 */
export type AiEndpoint = "analyze" | "embedding";

export interface AiStubResponse {
  status: number;
  body?: unknown;
  /** Simula que el fetch rechaza (Backend IA caído). */
  networkError?: boolean;
}

export type AiStubResponder = AiStubResponse | ((call: AiStubCall) => AiStubResponse);

export interface AiStubCall {
  endpoint: AiEndpoint;
  url: string;
  body: unknown;
  headers: Record<string, string>;
}

export interface AiStub {
  calls: AiStubCall[];
  callsTo(endpoint: AiEndpoint): AiStubCall[];
  respond(endpoint: AiEndpoint, responder: AiStubResponder): void;
  restore(): void;
}

const DEFAULT_RESPONSES: Record<AiEndpoint, AiStubResponse> = {
  analyze: { status: 200, body: { has_animal: true } },
  embedding: { status: 201, body: {} },
};

function classify(url: string): AiEndpoint | undefined {
  const { pathname } = new URL(url);
  if (pathname.endsWith("/images/analyze")) return "analyze";
  if (/\/reports\/\d+\/embedding$/.test(pathname)) return "embedding";
  return undefined;
}

function toUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function installAiStub(initial: Partial<Record<AiEndpoint, AiStubResponder>> = {}): AiStub {
  const originalFetch = global.fetch;
  const responders: Record<AiEndpoint, AiStubResponder> = { ...DEFAULT_RESPONSES, ...initial };
  const calls: AiStubCall[] = [];

  global.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = toUrl(input);
    const endpoint = classify(url);
    if (!endpoint) {
      // Cortar acá en vez de salir a la red: un test e2e nunca debería tocar
      // un servicio externo real.
      throw new Error(`[ai-stub] fetch no esperado a ${url}`);
    }

    const call: AiStubCall = {
      endpoint,
      url,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
      headers: { ...(init?.headers as Record<string, string> | undefined) },
    };
    calls.push(call);

    const responder = responders[endpoint];
    const response = typeof responder === "function" ? responder(call) : responder;
    if (response.networkError) {
      throw new TypeError("fetch failed");
    }
    return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  return {
    calls,
    callsTo: (endpoint) => calls.filter((call) => call.endpoint === endpoint),
    respond: (endpoint, responder) => {
      responders[endpoint] = responder;
    },
    restore: () => {
      global.fetch = originalFetch;
    },
  };
}
