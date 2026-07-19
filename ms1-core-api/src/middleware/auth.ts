import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; role: string };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing or malformed authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "insufficient permissions" });
    }
    next();
  };
}

export function requireInternalAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-internal-api-key"];
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    return res.status(500).json({ error: "Internal API Key not configured" });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: "invalid internal API key" });
  }

  next();
}