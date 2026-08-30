import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/httpError.js";
import { sendFail } from "../lib/respond.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0]?.message ?? "Validation failed";
    sendFail(res, 400, first);
    return;
  }
  if (err instanceof HttpError) {
    sendFail(res, err.status, err.message);
    return;
  }
  console.error(err);
  sendFail(res, 500, "Internal server error");
}
