import "dotenv/config";
import { createServer } from "http";
import { app } from "./app";
import { initChatSocket } from "./sockets/chat.socket";

const PORT = process.env.PORT ?? 3001;

const httpServer = createServer(app);
initChatSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});
