// estado del Backend IA para /health y el arranque (#220)
const PING_TIMEOUT_MS = 3_000;

export type AiServiceStatus = "configured" | "not_configured";
export type AiServicePing = "ok" | "unavailable" | "not_configured";

function aiServiceUrl(env: NodeJS.ProcessEnv): string | undefined {
  return env.AI_SERVICE_URL?.trim() || undefined;
}

export function getAiServiceStatus(env: NodeJS.ProcessEnv = process.env): AiServiceStatus {
  return aiServiceUrl(env) ? "configured" : "not_configured";
}

// sin la variable, los reportes con foto quedan en pending sin ningún error visible
export function warnIfAiServiceMissing(env: NodeJS.ProcessEnv = process.env): void {
  if (aiServiceUrl(env)) return;
  console.warn(
    "[ai] AI_SERVICE_URL no está configurada: los reportes con foto se crean en pending y no se moderan " +
      "ni se publican hasta configurarla (ver backend/README.md)."
  );
}

export async function pingAiService(env: NodeJS.ProcessEnv = process.env): Promise<AiServicePing> {
  const baseUrl = aiServiceUrl(env);
  if (!baseUrl) return "not_configured";
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
    return response.ok ? "ok" : "unavailable";
  } catch {
    return "unavailable";
  }
}
