import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth.routes";
import { petsRouter } from "./routes/pets.routes";
import { uploadsRouter } from "./routes/uploads.routes";
import { reportsRouter } from "./routes/reports.routes";
import { geoRouter } from "./routes/geo.routes";
import { businessesRouter } from "./routes/businesses.routes";
import { chatsRouter } from "./routes/chats.routes";
import { errorHandler } from "./middlewares/error-handler";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET no está definida. Configurá la variable de entorno antes de iniciar el servidor.");
}

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/pets", petsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/geo", geoRouter);
app.use("/api/businesses", businessesRouter);
app.use("/api/chats", chatsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { message: "Recurso no encontrado" } });
});

app.use(errorHandler);
