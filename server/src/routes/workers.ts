import { Router } from "express";
import { z } from "zod";
import { auth, currentUser, requireRole, routeId } from "../middleware/auth.js";
import { sendOk } from "../lib/respond.js";
import { HttpError } from "../lib/httpError.js";
import { prisma } from "../lib/prisma.js";
import { parseOfficialCategory } from "../lib/taxonomy.js";
import { getWorkerProfile, getWorkerReviews, listWorkerProfiles } from "../services/workers.js";

const updateWorkerSchema = z.object({
  category: z
    .string()
    .optional()
    .nullable()
    .transform((value, ctx) => {
      if (value == null || value === "") return null;
      const parsed = parseOfficialCategory(value);
      if (!parsed) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid category" });
        return z.NEVER;
      }
      return parsed;
    }),
  isAvailable: z.boolean().optional(),
});

export const workersRouter = Router();
workersRouter.use(auth);

workersRouter.get("/me", requireRole("AGENT"), async (req, res, next) => {
  try {
    const { sub } = currentUser(req);
    const worker = await getWorkerProfile(sub);
    if (!worker) throw new HttpError(404, "Worker profile not found");
    const reviews = await getWorkerReviews(sub, 20);
    sendOk(res, { worker, reviews });
  } catch (err) {
    next(err);
  }
});

workersRouter.patch("/me", requireRole("AGENT"), async (req, res, next) => {
  try {
    const body = updateWorkerSchema.parse(req.body);
    const { sub } = currentUser(req);
    if (Object.keys(body).length === 0) {
      throw new HttpError(400, "No fields to update");
    }
    await prisma.user.update({
      where: { id: sub },
      data: {
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.isAvailable !== undefined ? { isAvailable: body.isAvailable } : {}),
      },
    });
    const worker = await getWorkerProfile(sub);
    if (!worker) throw new HttpError(404, "Worker profile not found");
    sendOk(res, { worker });
  } catch (err) {
    next(err);
  }
});

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
