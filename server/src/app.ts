import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { corsOptions } from "./lib/cors.js";
import { authRouter } from "./routes/auth.js";
import { ticketsRouter } from "./routes/tickets.js";
import { usersRouter } from "./routes/users.js";
import { statsRouter } from "./routes/stats.js";
import { workersRouter } from "./routes/workers.js";
import { adminRouter } from "./routes/admin.js";
import { errorHandler } from "./middleware/error.js";
import { sendOk } from "./lib/respond.js";

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    sendOk(res, { ok: true, service: "lumen-api" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/workers", workersRouter);
  app.use("/api/admin", adminRouter);

  app.use(errorHandler);
  return app;
}
