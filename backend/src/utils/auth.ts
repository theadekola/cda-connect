import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export type TokenUser = { id: string; email: string };
export function signAccess(user: TokenUser) {
  return jwt.sign(user, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'] });
}
export function signRefresh(user: TokenUser) {
  return jwt.sign(user, env.JWT_REFRESH_SECRET, { expiresIn: `${env.JWT_REFRESH_EXPIRES_DAYS}d` });
}
export function verifyAccess(token: string) { return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenUser; }
export function verifyRefresh(token: string) { return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenUser; }
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
