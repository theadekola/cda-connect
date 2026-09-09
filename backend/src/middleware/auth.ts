import type { NextFunction, Request, Response } from 'express';
import { verifyAccess } from '../utils/auth.js';
import { getPool, sql } from '../config/db.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers.authorization;
  if (!raw?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = verifyAccess(raw.slice(7)); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
  try {
    const user = await (await getPool()).request().input('id', sql.UniqueIdentifier, req.user.id)
      .query("SELECT Id FROM Users WHERE Id=@id AND AccountStatus='ACTIVE'");
    if (!user.recordset[0]) return res.status(403).json({ error: 'Account is not active' });
    next();
  } catch (error) { next(error); }
}
