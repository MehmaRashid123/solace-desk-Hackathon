import type { Response } from "express";

export function sendOk<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ success: true, data, error: null });
}

export function sendFail(res: Response, status: number, error: string) {
  res.status(status).json({ success: false, data: null, error });
}
