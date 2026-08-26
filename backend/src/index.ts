import "dotenv/config";
import { createServer } from "http";
import { app } from "./app";
import { initChatSocket } from "./sockets/chat.socket";
import { startPendingReportsReconciliation } from "./services/matching.service";

const PORT = process.env.PORT ?? 3001;

const httpServer = createServer(app);
initChatSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
  // Rescata los reportes que quedaron en "pending" porque el Backend IA estaba
  // caído cuando se creó el reporte (o porque este proceso se reinició con la
  // llamada en vuelo). Ver matching.service.reconcilePendingReports.
  startPendingReportsReconciliation();
});
