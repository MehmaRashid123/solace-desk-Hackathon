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
import { graphql } from "graphql";
import { schema } from "./graphql/schema.js";
import { rootResolver } from "./graphql/resolvers.js";
import { verifyAccessToken } from "./lib/jwt.js";
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

  // REST endpoints
  app.use("/api/auth", authRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/workers", workersRouter);
  app.use("/api/admin", adminRouter);

  // GraphQL endpoint
  app.post("/graphql", async (req, res) => {
    const { query, variables, operationName } = req.body ?? {};
    if (!query) {
      return res.status(400).json({ errors: [{ message: "Must provide query string." }] });
    }

    const authHeader = req.headers["authorization"] || (req.headers as any)["Authorization"];
    let actor = null;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7).trim();
        const payload = verifyAccessToken(token);
        actor = {
          sub: payload.sub,
          role: payload.role as any,
          name: payload.name,
          email: payload.email,
        };
      } catch {
        // invalid token -> null
      }
    }

    const result = await graphql({
      schema,
      source: query,
      rootValue: rootResolver,
      contextValue: { actor },
      variableValues: variables,
      operationName,
    });

    return res.json(result);
  });

  app.get("/graphql", async (req, res) => {
    const query = typeof req.query.query === "string" ? req.query.query : "";
    if (!query) {
      return res.status(400).json({ errors: [{ message: "Must provide query string." }] });
    }
    const result = await graphql({
      schema,
      source: query,
      rootValue: rootResolver,
      contextValue: { actor: null },
    });
    return res.json(result);
  });

  app.use(errorHandler);
  return app;
}


