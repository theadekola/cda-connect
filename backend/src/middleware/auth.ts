import type { NextFunction, Request, Response } from 'express';
import { verifyAccess } from '../utils/auth.js';
import { getPool, sql } from '../config/db.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers.authorization;
  if (!raw?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = verifyAccess(raw.slice(7)); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
  try {
    const user = await (await getPool()).request().input('id', sql.UniqueIdentifier, req.user.id).input('family',sql.UniqueIdentifier,req.user.sessionId??null)
      .query("SELECT Id,SecurityHoldUntil FROM Users WHERE Id=@id AND AccountStatus='ACTIVE' AND EXISTS(SELECT 1 FROM UserSessions WHERE UserId=@id AND FamilyId=@family AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME())");
    if (!user.recordset[0]) return res.status(401).json({ error: 'Session is no longer active' });
    if(user.recordset[0].SecurityHoldUntil&&new Date(user.recordset[0].SecurityHoldUntil)>new Date()&&((!['GET','HEAD'].includes(req.method)&&(/password|two-factor|account\/(email|phone|deactivate|download)|finance|payment|withdraw|security-settings/.test(req.originalUrl)||(req.originalUrl.includes('/users/me')&&req.body?.phone!==undefined)))||req.originalUrl.split('?')[0].endsWith('/account/export')))return res.status(423).json({error:'Sensitive account actions are temporarily paused after your email change.',until:user.recordset[0].SecurityHoldUntil});
    next();
  } catch (error) { next(error); }
}
