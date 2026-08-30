import { Router } from "express";
import { auth, currentUser } from "../middleware/auth.js";
import { getDashboardStats } from "../services/stats.js";
import { sendOk } from "../lib/respond.js";

export const statsRouter = Router();
statsRouter.use(auth);

statsRouter.get("/", async (req, res, next) => {
  try {
    const user = currentUser(req);
    sendOk(res, { stats: await getDashboardStats(user.role, user.sub) });
  } catch (err) {
    next(err);
  }
});
