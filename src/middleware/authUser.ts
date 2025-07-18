import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";

// Augment Request type (optional quick declaration)
declare module "express-serve-static-core" {
  interface Request {
    user?: { userId: string; role: string };
  }
}

export function authUser(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "NO_TOKEN" });
  }
  const token = auth.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { userId: decoded.sub, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}
