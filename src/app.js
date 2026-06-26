import express from "express";
import cors from "cors";
import { analyzeTicket } from "./controllers/analyzeController.js";
import { toPublicError } from "./utils/errors.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/analyze-ticket", analyzeTicket);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Malformed JSON input" });
  }

  const publicError = toPublicError(error);
  return res.status(publicError.statusCode).json(publicError.body);
});

export default app;
