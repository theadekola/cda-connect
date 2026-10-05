import {Capacitor} from '@capacitor/core';
import {resolveAssetUrl} from './assetUrl';
export type RecordData=Record<string,unknown>;
export type User={Id:string;FirstName:string;LastName:string;Email:string;Phone?:string;ProfileImage?:string;IsSuperAdmin?:boolean;IsProtectedAccount?:boolean};
export type Session={accessToken:string;user:User};
// Credentials live only in memory. The refresh credential is an HttpOnly cookie.
try{sessionStorage.removeItem('cda-connect-session');localStorage.removeItem('cda-connect-session')}catch{}
let current:Session|null=null;
const listeners=new Set<()=>void>();let refreshPromise:Promise<void>|null=null;
export const session={get:()=>current,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}},set:(value:Session|null)=>{current=value?{accessToken:value.accessToken,user:value.user}:null;listeners.forEach(fn=>fn())}};
export async function restoreSession(){try{await refreshSession()}catch{session.set(null)}}
async function refreshSession(){if(!refreshPromise){const refresh=async()=>{const data=await perform<Session>('/auth/refresh',{method:'POST',body:'{}'},false);session.set(data)};refreshPromise=(async()=>{if(navigator.locks)await navigator.locks.request('cda-refresh',refresh);else await refresh()})().finally(()=>{refreshPromise=null})}return refreshPromise}
export class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
function base(){const configured=import.meta.env.VITE_API_URL;const value=Capacitor.isNativePlatform()&&(!configured||configured.startsWith('/'))?'https://cdaconnect.org/api/v1':configured;if(!value)throw new ApiError(0,'Set VITE_API_URL before connecting to your backend.');const url=new URL(value,window.location.origin);if(import.meta.env.PROD&&url.protocol!=='https:')throw new ApiError(0,'Production API URL must use HTTPS.');return value.replace(/\/$/,'')}
async function perform<T>(path:string,options:RequestInit={},retry=true):Promise<T>{
 const token=current?.accessToken;const headers=new Headers(options.headers);headers.set('x-cda-client','app');if(token)headers.set('Authorization','Bearer '+token);if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
 let response:Response;try{response=await fetch(base()+path,{...options,headers,cache:'no-store',credentials:'include',signal:options.signal??AbortSignal.timeout(20000)})}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(0,'Unable to connect. Check your network and retry.')}
 if(response.status===401&&retry&&current&&!['/auth/refresh','/auth/login','/auth/register','/auth/logout'].includes(path)){
  try{await refreshSession()}catch(e){session.set(null);throw e}
  if(!current)throw new ApiError(401,'Your session has ended.');return perform<T>(path,options,false);
 }
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new ApiError(response.status,data.error||'The request could not be completed.')}
 return response.status===204?undefined as T:response.json() as Promise<T>;
}
function asset(value:string){if(!value)return '';try{return resolveAssetUrl(value,base(),window.location.origin)}catch{return value}}
export function socketOrigin(){return import.meta.env.VITE_SOCKET_URL||new URL(base(),window.location.origin).origin}
export const api={url:(path:string)=>base()+path,get:<T>(p:string,signal?:AbortSignal,headers?:HeadersInit)=>perform<T>(p,{signal,headers}),send:<T=RecordData>(p:string,body:unknown={},method='POST')=>perform<T>(p,{method,body:JSON.stringify(body)}),upload:<T>(p:string,data:FormData)=>perform<T>(p,{method:'POST',body:data}),asset};
export function rows(value:unknown):RecordData[]{if(Array.isArray(value))return value as RecordData[];if(value&&typeof value==='object'){const v=value as RecordData;for(const key of ['items','data','posts','documents','members'])if(Array.isArray(v[key]))return v[key] as RecordData[]}return[]}
export const str=(v:unknown)=>v===null||v===undefined?'':String(v);


export function publicOrigin(){return new URL(import.meta.env.VITE_PUBLIC_ORIGIN||base(),window.location.origin).origin}
