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
      console.log(`[AUTH_OK] JWT valid — userId=${payload.userId} path=${req.path}`);
      return next();
    }
    console.log(`[AUTH_FAIL] JWT invalid/expired — path=${req.path}`);
  }

  if (req.session.userId) {
    req.userId = req.session.userId;
    console.log(`[AUTH_OK] session valid — userId=${req.session.userId} path=${req.path}`);
    return next();
  }

  console.log(`[AUTH_FAIL] no valid token or session — ${req.method} ${req.path}`);
  res.status(401).json({ error: "Não autenticado" });
}
