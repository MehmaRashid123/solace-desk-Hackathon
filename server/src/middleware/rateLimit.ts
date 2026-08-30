import rateLimit from "express-rate-limit";
import { sendFail } from "../lib/respond.js";

const max = process.env.NODE_ENV === "test" ? 1000 : 20;

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendFail(res, 429, "Too many attempts. Try again in a few minutes.");
  },
});
