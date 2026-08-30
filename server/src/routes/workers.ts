import { Router } from "express";
import { z } from "zod";
import { auth, requireRole, routeId } from "../middleware/auth.js";
import { sendOk } from "../lib/respond.js";
import { HttpError } from "../lib/httpError.js";
import { getWorkerProfile, getWorkerReviews, listWorkerProfiles } from "../services/workers.js";

export const workersRouter = Router();
workersRouter.use(auth);

workersRouter.get("/", requireRole("CUSTOMER", "ADMIN"), async (req, res, next) => {
  try {
    const idsParam = typeof req.query.ids === "string" ? req.query.ids : undefined;
    const ids = idsParam?.split(",").filter(Boolean);
    const all = await listWorkerProfiles(ids?.length ? ids : undefined);
    sendOk(res, { workers: all });
  } catch (err) {
    next(err);
  }
});

workersRouter.get("/:id/reviews", requireRole("CUSTOMER", "ADMIN"), async (req, res, next) => {
  try {
    const limit = z.coerce.number().int().min(1).max(20).catch(10).parse(req.query.limit);
    const workerId = routeId(req);
    const worker = await getWorkerProfile(workerId);
    if (!worker) throw new HttpError(404, "Worker not found");
    const reviews = await getWorkerReviews(workerId, limit);
    sendOk(res, { reviews });
  } catch (err) {
    next(err);
  }
});

workersRouter.get("/:id", requireRole("CUSTOMER", "ADMIN"), async (req, res, next) => {
  try {
    const worker = await getWorkerProfile(routeId(req));
    if (!worker) throw new HttpError(404, "Worker not found");
    sendOk(res, { worker });
  } catch (err) {
    next(err);
  }
});
