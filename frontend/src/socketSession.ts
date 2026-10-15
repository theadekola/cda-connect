import {io,type Socket} from 'socket.io-client';
import {refreshSession,session,socketOrigin} from './api';

function expiresSoon(token:string){
 try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return Number(payload.exp)*1000<Date.now()+90000}catch{return false}
}
// Renew credentials on the existing connection so WebRTC rooms survive rotation.
export function authenticatedSocket(){
 const socket=io(socketOrigin(),{autoConnect:false,auth:done=>{void(async()=>{try{const current=session.get();if(current&&expiresSoon(current.accessToken))await refreshSession()}catch{}done({token:session.get()?.accessToken})})()}});
 let stopped=false,renewing=false,lastToken='';
 async function renew(){
  if(stopped||renewing||!session.get())return;
  renewing=true;
  try{
   if(expiresSoon(session.get()!.accessToken))await refreshSession();
   const token=session.get()?.accessToken;
   if(stopped||!socket.connected||!token||token===lastToken)return;
   await new Promise<void>((resolve,reject)=>socket.timeout(10000).emit('session:refresh',{token},(error:Error|null,result:{ok?:boolean})=>error||!result?.ok?reject(error||Error('Session renewal failed')):resolve()));
   lastToken=token;
  }catch{/* Retry on the next tick; the server still enforces expiry and revocation. */}
  finally{renewing=false}
 }
 const connected=()=>{lastToken='';void renew()};
 socket.on('connect',connected);
 const unsubscribe=session.subscribe(()=>void renew()),timer=setInterval(()=>void renew(),30000);
 const visible=()=>{if(document.visibilityState==='visible')void renew()};
 document.addEventListener('visibilitychange',visible);
 return {socket,dispose(){stopped=true;clearInterval(timer);unsubscribe();document.removeEventListener('visibilitychange',visible);socket.off('connect',connected);socket.disconnect()}};
}
