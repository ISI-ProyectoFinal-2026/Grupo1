import type { Logger } from "./ports";

// próxima ejecución a `hour`:00 hora local, siempre estrictamente en el futuro
export function nextRunAt(now: Date, hour: number): Date {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// programa el job todos los días; un fallo se registra y no corta la cadena
export function startDailySchedule(
  job: () => Promise<void>,
  hour: number,
  logger: Logger
): () => void {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const scheduleNext = (): void => {
    if (stopped) return;
    const next = nextRunAt(new Date(), hour);
    logger.info(`Próximo backup: ${next.toString()}`);
    timer = setTimeout(async () => {
      try {
        await job();
      } catch (error) {
        logger.error(`El backup programado falló: ${(error as Error).message}`);
      }
      scheduleNext();
    }, next.getTime() - Date.now());
  };

  scheduleNext();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
