import "dotenv/config";
import { createServer } from "http";
import { app } from "./app";
import { initChatSocket } from "./sockets/chat.socket";
import { startPendingReportsReconciliation } from "./services/matching.service";
import { startSanctionExpirySweep } from "./services/account-sanctions/sweep";
import { startInactivitySweep } from "./services/report-inactivity.service";
import { assertMonetizationConfig } from "./config/plans";
import { warnIfAiServiceMissing } from "./config/ai-service";
import { warnIfRedisMissing } from "./config/redis";
import { enqueueReportPipeline, startReportPipelineWorker } from "./services/report-pipeline.service";

assertMonetizationConfig();
warnIfAiServiceMissing();
warnIfRedisMissing();

const PORT = process.env.PORT ?? 3001;

const httpServer = createServer(app);
initChatSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
  // Rescata los reportes que quedaron en "pending" porque el Backend IA estaba
  // caído cuando se creó el reporte (o porque este proceso se reinició con la
  // llamada en vuelo). Ver matching.service.reconcilePendingReports.
  // Reencola por la cola Redis (#177); sin REDIS_URL, en proceso.
  startPendingReportsReconciliation(enqueueReportPipeline);
  // Worker de la cola del pipeline IA (#177); sin REDIS_URL no arranca.
  startReportPipelineWorker();
  // Registra el vencimiento de las suspensiones temporales cumplidas (#38).
  startSanctionExpirySweep();
  // avisos y cierre por inactividad de reportes (#264)
  startInactivitySweep();
});
