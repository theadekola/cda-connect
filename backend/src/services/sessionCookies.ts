import type {Request,Response,NextFunction} from 'express';
import {env} from '../config/env.js';
import {AppError} from '../utils/errors.js';
export const refreshCookieName=env.NODE_ENV==='production'?'__Secure-cda-refresh':'cda-refresh';
export function refreshCookie(req:Request){const part=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(refreshCookieName+'='));try{return part?decodeURIComponent(part.slice(refreshCookieName.length+1)):''}catch{return ''}}
const cookieOptions={httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'strict' as const,path:'/api/v1'};
export function setRefreshCookie(res:Response,token:string){res.cookie(refreshCookieName,token,{...cookieOptions,maxAge:env.JWT_REFRESH_EXPIRES_DAYS*86400000});res.set('Cache-Control','no-store')}
export function clearRefreshCookie(res:Response){res.clearCookie(refreshCookieName,cookieOptions)}
export function trustedWebOrigins(){
 const values=[env.PUBLIC_BASE_URL,...env.CORS_ORIGIN.split(',')];
 return [...new Set(values.flatMap(value=>{const candidate=value.trim();if(!candidate||candidate==='*')return [];try{return [new URL(candidate).origin]}catch{return []}}))];
}
export const nativeClientOrigins=['capacitor://localhost','https://localhost'] as const;
export function trustedRequestOrigins(){return [...new Set([...trustedWebOrigins(),...nativeClientOrigins])]}
function normalizedOrigin(value:string|undefined){if(!value||value==='null')return '';const parsed=new URL(value);return parsed.protocol==='capacitor:'&&parsed.hostname==='localhost'?'capacitor://localhost':parsed.origin}
export function protectCookieMutation(req:Request,res:Response,next:NextFunction){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 let requestOrigin='',refererOrigin='';
 try{requestOrigin=normalizedOrigin(req.headers.origin);refererOrigin=normalizedOrigin(req.headers.referer)}catch{return next(new AppError(403,'Untrusted request origin'))}
 const webOrigins=new Set(trustedWebOrigins()),nativeOrigins=new Set<string>(nativeClientOrigins);
 const trustedBrowser=requestOrigin!==''&&webOrigins.has(requestOrigin);
 // Sec-Fetch-Site is a forbidden browser header. When Chrome says the request
 // is same-origin, trust that signal even if a mobile browser supplies an
 // opaque or otherwise unexpected Origin value. Cross-site requests still
 // have to match an explicitly configured web origin.
 const trustedBrowserMetadata=req.headers['sec-fetch-site']==='same-origin';
 const trustedBrowserFallback=requestOrigin===''&&webOrigins.has(refererOrigin);
 const trustedNative=req.headers['x-cda-client']==='app'&&nativeOrigins.has(requestOrigin);
 const trustedNonBrowser=requestOrigin===''&&!req.headers.origin&&!req.headers['sec-fetch-site']&&req.headers['x-cda-client']==='app';
 if(!trustedBrowser&&!trustedBrowserMetadata&&!trustedBrowserFallback&&!trustedNative&&!trustedNonBrowser)return next(new AppError(403,'Untrusted request origin'));
 next();
}
