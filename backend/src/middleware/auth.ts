import {env} from '../config/env.js';
import type { NextFunction, Request, Response } from 'express';
import { verifyAccess } from '../utils/auth.js';
import {requestAccessToken} from '../services/sessionCookies.js';
import { getPool, sql } from '../config/db.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control','no-store');
  const token = requestAccessToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  let identity: ReturnType<typeof verifyAccess>;
  try { identity = verifyAccess(token); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
  try {
    const user = await (await getPool()).request().input('id', sql.UniqueIdentifier, identity.id).input('maxHours',sql.Int,env.SESSION_MAX_HOURS).input('family',sql.UniqueIdentifier,identity.sessionId??null)
      .query("SELECT Id,SecurityHoldUntil,Email FROM Users WHERE Id=@id AND AccountStatus='ACTIVE' AND EXISTS(SELECT 1 FROM UserSessions WHERE UserId=@id AND FamilyId=@family AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME() AND (SELECT MIN(origin.CreatedAt) FROM UserSessions origin WHERE origin.FamilyId=@family)>DATEADD(hour,-@maxHours,SYSUTCDATETIME()))");
    if (!user.recordset[0]) return res.status(401).json({ error: 'Session is no longer active' });
    if(user.recordset[0].SecurityHoldUntil&&new Date(user.recordset[0].SecurityHoldUntil)>new Date()&&((!['GET','HEAD'].includes(req.method)&&(/password|two-factor|account\/(email|phone|deactivate|download)|finance|payment|withdraw|security-settings/.test(req.originalUrl)||(req.originalUrl.includes('/users/me')&&req.body?.phone!==undefined)))||req.originalUrl.split('?')[0].endsWith('/account/export')))return res.status(423).json({error:'Sensitive account actions are temporarily paused after your email change.',until:user.recordset[0].SecurityHoldUntil});
    req.user={...identity,email:user.recordset[0].Email};
    next();
  } catch (error) { next(error); }
}
