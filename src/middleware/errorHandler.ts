import { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err.status) {
    return res.status(err.status).json({
      error: err.code || "ERROR",
      message: err.message
    });
  }
  console.error(err);
  res.status(500).json({ error: "INTERNAL", message: "Unexpected error" });
}
