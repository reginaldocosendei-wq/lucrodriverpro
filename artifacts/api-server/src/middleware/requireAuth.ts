import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      req.userId = payload.userId;
      console.log(`[requireAuth] JWT valid — userId=${payload.userId} path=${req.path}`);
      return next();
    }
    console.log(`[requireAuth] JWT invalid/expired — path=${req.path}`);
  }

  if (req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }

  console.log(`[requireAuth] REJECTED — no valid token or session — path=${req.method} ${req.path}`);
  res.status(401).json({ error: "Não autenticado" });
}
