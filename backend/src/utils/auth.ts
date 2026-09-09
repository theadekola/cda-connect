import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export type TokenUser = { id: string; email: string };
export function signAccess(user: TokenUser) {
  return jwt.sign({ ...user, purpose: 'access' }, env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'] });
}
export function signRefresh(user: TokenUser) {
  return jwt.sign({ ...user, purpose: 'refresh' }, env.JWT_REFRESH_SECRET, { algorithm: 'HS256', jwtid: crypto.randomUUID(), expiresIn: `${env.JWT_REFRESH_EXPIRES_DAYS}d` });
}
function verifySessionToken(token: string, secret: string, purpose: 'access' | 'refresh'): TokenUser {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || payload.purpose !== purpose || typeof payload.exp !== 'number' || typeof payload.id !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Invalid session token');
  }
  return { id: payload.id, email: payload.email };
}
export function verifyAccess(token: string) { return verifySessionToken(token, env.JWT_ACCESS_SECRET, 'access'); }
export function verifyRefresh(token: string) { return verifySessionToken(token, env.JWT_REFRESH_SECRET, 'refresh'); }
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
