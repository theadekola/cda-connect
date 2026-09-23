import {NativePushSettings,disconnectNativePush} from './nativePush';
import {Smartphone} from 'lucide-react';
import {useEffect,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {api} from './api';

const supported=()=>!Capacitor.isNativePlatform()&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&window.isSecureContext;
const installed=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
async function subscription(){const reg=await navigator.serviceWorker.getRegistration('/');return reg?.pushManager.getSubscription()??null}
export async function disconnectPush(){
 if(Capacitor.isNativePlatform()){await disconnectNativePush();return}
 if(!supported())return;
 const sub=await subscription();
 if(sub){await api.send('/users/web-push/subscribe',{endpoint:sub.endpoint},'DELETE');await sub.unsubscribe()}
}
function applicationKey(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0))}

export function PushSettings(props:{home?:boolean;compact?:boolean}){return Capacitor.isNativePlatform()?(props.home?null:<NativePushSettings/>):<WebPushSettings {...props}/>}
function WebPushSettings({home=false,compact=false}:{home?:boolean;compact?:boolean}){
 const[key,setKey]=useState<string|null>(null),[sub,setSub]=useState<PushSubscription|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[ready,setReady]=useState(false);
 useEffect(()=>{let active=true;if(!supported()){setReady(true);return}
  Promise.all([api.get<{publicKey:string|null}>('/users/web-push/key'),subscription()]).then(async([config,existing])=>{
   // Rebind on account changes/reinstallation; never assume permission alone means registered.
   if(existing&&config.publicKey)await api.send('/users/web-push/subscribe',existing.toJSON());
   if(active){setKey(config.publicKey);setSub(existing);setReady(true)}
  }).catch(()=>{if(active){setMessage('Unable to check notification setup. Reopen this page when online.');setReady(true)}});
  return()=>{active=false};
 },[]);
 async function enable(){
  setBusy(true);setMessage('');
  try{
   // Request directly from this click, before any network work (required by iOS).
   const permission=await Notification.requestPermission();
   if(permission!=='granted'){setMessage('Notifications were not enabled. You can allow them in your device or browser settings.');return}
   await navigator.serviceWorker.register('/sw.js');
   const reg=await navigator.serviceWorker.ready;
   const current=await reg.pushManager.getSubscription();
   const next=current??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(key!)});
   await api.send('/users/web-push/subscribe',next.toJSON());setSub(next);setMessage('Notifications enabled on this device.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to enable notifications')}
  finally{setBusy(false)}
 }
 async function disable(){setBusy(true);try{await disconnectPush();setSub(null);setMessage('Notifications disabled on this device.')}catch{setMessage('Unable to disable notifications. Please retry while online.')}finally{setBusy(false)}}
 async function test(){if(!sub)return;setBusy(true);try{await api.send('/users/web-push/test',{endpoint:sub.endpoint});setMessage('Test sent to your device’s notification service.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to send test')}finally{setBusy(false)}}
 if(home&&(!installed()||sub||!supported()))return null;
 if(compact)return <div className="notification-push"><label className="settings-row account-switch-row"><span className="settings-row-icon"><Smartphone size={21}/></span><span className="settings-row-text"><strong>Push Notifications</strong><small>Receive notifications on this device</small></span><input type="checkbox" role="switch" checked={!!sub} disabled={busy||!ready||!key||!supported()} onChange={()=>void(sub?disable():enable())}/></label>{!supported()?<p className="privacy-note">{Capacitor.isNativePlatform()?'Push registration is not configured in this native build. Use the installed Home Screen web app for device push.':'On iPhone or iPad, open the app from your Home Screen to enable push. This browser must support Web Push.'}</p>:!ready?<p role="status">Checking device…</p>:!key?<p className="privacy-note">Push delivery needs server configuration.</p>:sub?<button className="notification-test" disabled={busy} onClick={()=>void test()}>Send test notification</button>:null}{message&&<p role="status">{message}</p>}</div>;
 if(Capacitor.isNativePlatform())return null;
 return <section className="push-settings" aria-label="Device notifications"><h2>Push notifications</h2>
  {!supported()?<p>For iPhone or iPad, add CDA Connect to your Home Screen from Safari, then open it there to enable notifications. Requires iOS or iPadOS 16.4 or later. Other devices need a browser supporting Web Push.</p>:
   <><p>{sub?'Notifications are enabled on this device.':'Get community notifications even when CDA Connect is closed.'}</p>
   {!ready?<p>Checking notification setup…</p>:!key?<p>Push notifications need server configuration before they can be enabled.</p>:<div className="push-actions">{sub?<><button type="button" disabled={busy} onClick={()=>void disable()}>Disable notifications</button><button type="button" disabled={busy} onClick={()=>void test()}>Send test notification</button></>:<button type="button" disabled={busy} onClick={()=>void enable()}>Enable notifications</button>}</div>}</>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
