import { Router } from "express";
import { auth, currentUser, requireRole, routeId } from "../middleware/auth.js";
import { sendOk } from "../lib/respond.js";
import { HttpError } from "../lib/httpError.js";
import { getAdminOverview, getAdminWorkerDetail, getAdminWorkers } from "../services/admin.js";

export const adminRouter = Router();
adminRouter.use(auth);
adminRouter.use(requireRole("ADMIN"));

adminRouter.get("/overview", async (_req, res, next) => {
  try {
    currentUser(_req);
    sendOk(res, await getAdminOverview());
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/workers", async (_req, res, next) => {
  try {
    currentUser(_req);
    sendOk(res, await getAdminWorkers());
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/workers/:id", async (req, res, next) => {
  try {
    currentUser(req);
    const detail = await getAdminWorkerDetail(routeId(req));
    if (!detail) throw new HttpError(404, "Worker not found");
    sendOk(res, detail);
  } catch (err) {
    next(err);
  }
});