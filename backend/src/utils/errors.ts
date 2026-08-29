import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type RouteRequest = Request<Record<string, string>>;
type AsyncRouteHandler = (req: RouteRequest, res: Response, next: NextFunction) => unknown | Promise<unknown>;

export const asyncHandler = (fn: AsyncRouteHandler) =>
  (req: RouteRequest, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
export function notFound(_req: Request, res: Response) { res.status(404).json({ error: 'Route not found' }); }
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  if(err instanceof ZodError){
    const issue=err.issues[0];
    const field=issue?.path?.join('.')||'request';
    return res.status(400).json({error:issue?.message||'Invalid information',field,issues:err.issues});
  }
  const sqlNumber=Number(err?.number??err?.originalError?.info?.number);
  if(sqlNumber===2601||sqlNumber===2627) return res.status(409).json({error:'This information is already registered'});
  if(sqlNumber===207) return res.status(503).json({error:'The database needs the latest application update. Please contact support'});
  const status = err instanceof AppError ? err.status : 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
}
