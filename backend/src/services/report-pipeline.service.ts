import { Job, JobsOptions, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { getRedisUrl } from "../config/redis";
import * as matchingService from "./matching.service";

// Cola Redis del pipeline IA de los reportes (#177): moderación, embedding y matching.

export const REPORT_PIPELINE_QUEUE = "report-pipeline";

export interface ReportPipelineJobData {
  reportId: number;
  imageUrl: string;
}

// 5 intentos: esperas de 5s, 10s, 20s y 40s; terminados se borran para poder reencolar
export const REPORT_PIPELINE_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: true,
  removeOnFail: true,
} satisfies JobsOptions;

// El Backend IA infiere de forma síncrona: un job a la vez
const WORKER_CONCURRENCY = 1;

// BullMQ espera a Redis sin límite: pasado este tiempo se usa el fallback en proceso
export const ENQUEUE_TIMEOUT_MS = 5_000;

// estados en los que el job todavía no empezó y se puede reemplazar
const REPLACEABLE_STATES = new Set(["waiting", "delayed", "prioritized", "waiting-children"]);

let queue: Queue<ReportPipelineJobData> | null = null;
let worker: Worker<ReportPipelineJobData> | null = null;
const connections: Redis[] = [];

function createConnection(url: string, options: { forWorker: boolean }): Redis {
  // productor: falla rápido si Redis está caído (y se usa el fallback en proceso)
  const connection = new Redis(
    url,
    options.forWorker ? { maxRetriesPerRequest: null } : { maxRetriesPerRequest: 1, enableOfflineQueue: false }
  );
  // un log por caída, no uno por cada reintento de conexión
  let down = false;
  connection.on("error", (error) => {
    if (down) return;
    down = true;
    console.error("[cola-ia] error de conexión con Redis:", error);
  });
  connection.on("ready", () => {
    down = false;
  });
  connections.push(connection);
  return connection;
}

function getQueue(url: string): Queue<ReportPipelineJobData> {
  if (!queue) {
    queue = new Queue<ReportPipelineJobData>(REPORT_PIPELINE_QUEUE, {
      connection: createConnection(url, { forWorker: false }),
    });
  }
  return queue;
}

// jobId = reportId: un reporte tiene a lo sumo un job vivo
export function reportPipelineJobId(reportId: number): string {
  return `report-${reportId}`;
}

// un job en espera con otra foto se reemplaza; uno activo se deja terminar
async function replaceStaleJob(q: Queue<ReportPipelineJobData>, jobId: string, imageUrl: string): Promise<void> {
  const existing = await q.getJob(jobId);
  if (!existing || existing.data.imageUrl === imageUrl) return;
  if (REPLACEABLE_STATES.has(await existing.getState())) {
    await existing.remove();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Redis no respondió en ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function addJob(reportId: number, imageUrl: string, url: string): Promise<void> {
  const q = getQueue(url);
  const jobId = reportPipelineJobId(reportId);
  await replaceStaleJob(q, jobId, imageUrl);
  await q.add(REPORT_PIPELINE_QUEUE, { reportId, imageUrl }, { ...REPORT_PIPELINE_JOB_OPTIONS, jobId });
}

/**
 * Productor: encola el pipeline del reporte. Sin REDIS_URL, o si Redis no
 * acepta el job a tiempo, corre el pipeline en proceso (reintentos en memoria).
 */
export async function enqueueReportPipeline(reportId: number, imageUrl: string): Promise<void> {
  const url = getRedisUrl();
  if (!url) {
    matchingService.triggerEmbeddingGeneration(reportId, imageUrl);
    return;
  }
  if (!process.env.AI_SERVICE_URL) return;

  try {
    await withTimeout(addJob(reportId, imageUrl, url), ENQUEUE_TIMEOUT_MS);
  } catch (error) {
    console.error(`[cola-ia] no se pudo encolar el report ${reportId}; se procesa en proceso:`, error);
    matchingService.triggerEmbeddingGeneration(reportId, imageUrl);
  }
}

function logFailedJob(job: Job<ReportPipelineJobData> | undefined, error: Error): void {
  if (!job) return;
  const attempts = job.opts.attempts ?? 1;
  const reportId = job.data.reportId;
  if (job.attemptsMade >= attempts) {
    console.error(
      `[cola-ia] report ${reportId}: el pipeline IA falló ${job.attemptsMade} veces; queda en pending ` +
        `hasta la próxima reconciliación:`,
      error
    );
  } else {
    console.error(
      `[cola-ia] report ${reportId}: intento ${job.attemptsMade}/${attempts} fallido, se reintenta:`,
      error
    );
  }
}

/** Consumidor: se arranca con el server (ver src/index.ts). Sin REDIS_URL devuelve null. */
export function startReportPipelineWorker(): Worker<ReportPipelineJobData> | null {
  const url = getRedisUrl();
  if (!url) return null;
  if (worker) return worker;

  worker = new Worker<ReportPipelineJobData>(
    REPORT_PIPELINE_QUEUE,
    (job) => matchingService.processReportPipeline(job.data.reportId, job.data.imageUrl),
    { connection: createConnection(url, { forWorker: true }), concurrency: WORKER_CONCURRENCY }
  );
  worker.on("failed", logFailedJob);
  worker.on("error", (error) => {
    console.error("[cola-ia] error del worker:", error);
  });
  return worker;
}

// cierra cola, worker y conexiones (shutdown y tests)
export async function closeReportPipeline(): Promise<void> {
  const closing: Promise<unknown>[] = [];
  if (worker) closing.push(worker.close());
  if (queue) closing.push(queue.close());
  worker = null;
  queue = null;
  await Promise.allSettled(closing);
  await Promise.allSettled(connections.splice(0).map((connection) => connection.quit()));
}
