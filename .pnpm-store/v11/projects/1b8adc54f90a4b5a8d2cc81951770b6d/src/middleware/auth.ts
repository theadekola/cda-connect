import type { NextFunction, Request, Response } from 'express';
import { verifyAccess } from '../utils/auth.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers.authorization;
  if (!raw?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = verifyAccess(raw.slice(7)); next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}
