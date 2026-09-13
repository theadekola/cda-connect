import {Capacitor} from '@capacitor/core';
export type RecordData=Record<string,unknown>;
export type User={Id:string;FirstName:string;LastName:string;Email:string;Phone?:string;ProfileImage?:string};
export type Session={accessToken:string;refreshToken:string;user:User};
const sessionKey='cda-connect-session';
function restoredSession():Session|null{try{const raw=sessionStorage.getItem(sessionKey);return raw?JSON.parse(raw) as Session:null}catch{return null}}
let current:Session|null=restoredSession();
const listeners=new Set<()=>void>();
let refreshPromise:Promise<void>|null=null;
export const session={get:()=>current,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}},set:(value:Session|null)=>{current=value;try{if(value)sessionStorage.setItem(sessionKey,JSON.stringify(value));else sessionStorage.removeItem(sessionKey)}catch{}listeners.forEach(fn=>fn())}};
// Session storage survives a page refresh but is cleared when the browser/app session closes.
// Credentials are never stored in localStorage, the service worker or a long-lived device preference.
export class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
function base(){const configured=import.meta.env.VITE_API_URL;const value=Capacitor.isNativePlatform()&&(!configured||configured.startsWith('/'))?'https://cdaconnect.org/api/v1':configured;if(!value)throw new ApiError(0,'Set VITE_API_URL before connecting to your backend.');const url=new URL(value,window.location.origin);if(import.meta.env.PROD&&url.protocol!=='https:')throw new ApiError(0,'Production API URL must use HTTPS.');return value.replace(/\/$/,'')}
async function perform<T>(path:string,options:RequestInit={},retry=true):Promise<T>{
 const token=current?.accessToken;const headers=new Headers(options.headers);if(token)headers.set('Authorization','Bearer '+token);if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
 let response:Response;try{response=await fetch(base()+path,{...options,headers,cache:'no-store',signal:options.signal??AbortSignal.timeout(20000)})}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(0,'Unable to connect. Check your network and retry.')}
 if(response.status===401&&retry&&current&&!path.startsWith('/auth/')){
  const captured=current;
  if(!refreshPromise)refreshPromise=(async()=>{try{const data=await perform<{accessToken:string;refreshToken?:string}>('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:captured.refreshToken})},false);if(current===captured)session.set({...captured,...data})}catch(e){if(current===captured)session.set(null);throw e}finally{refreshPromise=null}})();
  await refreshPromise;if(!current)throw new ApiError(401,'Your session has ended.');return perform<T>(path,options,false);
 }
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new ApiError(response.status,data.error||'The request could not be completed.')}
 return response.status===204?undefined as T:response.json() as Promise<T>;
}
function asset(value:string){if(!value)return '';try{const url=new URL(value,window.location.origin),apiUrl=new URL(base(),window.location.origin);if(url.pathname.startsWith('/uploads/')||['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname)){url.protocol=apiUrl.protocol;url.host=apiUrl.host}return url.toString()}catch{return value}}
export function socketOrigin(){return import.meta.env.VITE_SOCKET_URL||new URL(base(),window.location.origin).origin}
export const api={url:(path:string)=>base()+path,get:<T>(p:string,signal?:AbortSignal,headers?:HeadersInit)=>perform<T>(p,{signal,headers}),send:<T=RecordData>(p:string,body:unknown={},method='POST')=>perform<T>(p,{method,body:JSON.stringify(body)}),upload:<T>(p:string,data:FormData)=>perform<T>(p,{method:'POST',body:data}),asset};
export function rows(value:unknown):RecordData[]{if(Array.isArray(value))return value as RecordData[];if(value&&typeof value==='object'){const v=value as RecordData;for(const key of ['items','data','posts','documents','members'])if(Array.isArray(v[key]))return v[key] as RecordData[]}return[]}
export const str=(v:unknown)=>v===null||v===undefined?'':String(v);

