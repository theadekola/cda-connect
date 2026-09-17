import type {Request,Response,NextFunction} from 'express';
import {env} from '../config/env.js';
import {AppError} from '../utils/errors.js';
export const refreshCookieName=env.NODE_ENV==='production'?'__Secure-cda-refresh':'cda-refresh';
export function refreshCookie(req:Request){const part=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(refreshCookieName+'='));try{return part?decodeURIComponent(part.slice(refreshCookieName.length+1)):''}catch{return ''}}
const cookieOptions={httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'strict' as const,path:'/api/v1'};
export function setRefreshCookie(res:Response,token:string){res.cookie(refreshCookieName,token,{...cookieOptions,maxAge:env.JWT_REFRESH_EXPIRES_DAYS*86400000});res.set('Cache-Control','no-store')}
export function clearRefreshCookie(res:Response){res.clearCookie(refreshCookieName,cookieOptions)}
export function protectCookieMutation(req:Request,res:Response,next:NextFunction){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const origins=new Set([new URL(env.PUBLIC_BASE_URL).origin,...env.CORS_ORIGIN.split(',').map(x=>x.trim())]);
 if(req.headers['x-cda-client']!=='app'||(req.headers.origin&&!origins.has(req.headers.origin)))return next(new AppError(403,'Untrusted request origin'));
 next();
}
