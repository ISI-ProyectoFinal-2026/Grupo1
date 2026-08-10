import express from "express";
import { petsRouter } from "./routes/pets.routes";
import { errorHandler } from "./middlewares/error-handler";

export const app = express();

app.use(express.json());

app.use("/api/pets", petsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { message: "Recurso no encontrado" } });
});

app.use(errorHandler);
