// conexión de la cola del pipeline IA (#177); sin REDIS_URL el pipeline corre en proceso
export function getRedisUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.REDIS_URL?.trim() || undefined;
}

export function warnIfRedisMissing(env: NodeJS.ProcessEnv = process.env): void {
  if (getRedisUrl(env)) return;
  console.warn(
    "[ai] REDIS_URL no está configurada: el pipeline IA de los reportes corre en proceso, sin cola " +
      "(los reintentos no sobreviven a un reinicio; ver backend/README.md)."
  );
}
