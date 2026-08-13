import express from "express";
import { petsRouter } from "./routes/pets.routes";
import { uploadsRouter } from "./routes/uploads.routes";
import { reportsRouter } from "./routes/reports.routes";
import { errorHandler } from "./middlewares/error-handler";

export const app = express();

app.use(express.json());

app.use("/api/pets", petsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/reports", reportsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { message: "Recurso no encontrado" } });
});

app.use(errorHandler);
