import {useEffect,useState} from 'react';
import {Capacitor,type PluginListenerHandle} from '@capacitor/core';
import {PushNotifications} from '@capacitor/push-notifications';
import {Smartphone} from 'lucide-react';
import {api,session} from './api';
import {NativeDevice} from './nativeDevice';
const key='cda-native-push';
const optOutKey='cda-native-push-disabled';
type Registration={token:string;userId:string};
function saved():Registration|null{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function optedOut(){return localStorage.getItem(optOutKey)===session.get()?.user.Id}
function savePreference(enabled:boolean){const userId=session.get()?.user.Id;if(enabled)localStorage.removeItem(optOutKey);else if(userId)localStorage.setItem(optOutKey,userId)}
export function nativeEnabled(){return saved()?.userId===session.get()?.user.Id&&!!saved()?.token}
export async function nativePushStatus(){
 const [build,server]=await Promise.all([NativeDevice.pushConfiguration(),api.get<{android:boolean;ios:boolean}>('/users/devices/push-config')]);
 const platform=Capacitor.getPlatform()==='ios'?'ios':'android';
 return {ready:build.configured&&server[platform],environment:build.environment,message:!build.configured?'Android push setup is pending. Add the Firebase app configuration and rebuild.':!server[platform]?'Push delivery setup is pending on the server.':'',enabled:nativeEnabled()&&(await PushNotifications.checkPermissions()).receive==='granted'};
}
let registering:Promise<void>|undefined;
export function enableNativePush(prompt=true){
 if(registering)return registering;
 registering=(async()=>{
  const userId=session.get()?.user.Id;if(!userId)throw Error('Sign in to enable notifications.');
  const config=await nativePushStatus();if(!config.ready)throw Error(config.message);
  let permission=await PushNotifications.checkPermissions();if(prompt&&permission.receive!=='granted')permission=await PushNotifications.requestPermissions();
  if(permission.receive!=='granted')throw Error('Allow notifications for CDA Connect in your phone settings.');
  const platform=Capacitor.getPlatform()==='ios'?'ios':'android';
  if(platform==='android')await PushNotifications.createChannel({id:'default',name:'Community notifications',importance:4});
  const handles:PluginListenerHandle[]=[];let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const value=await new Promise<string>((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('Device registration timed out. Check your connection and retry.')),20000);
    void(async()=>{handles.push(await PushNotifications.addListener('registration',token=>resolve(token.value)));handles.push(await PushNotifications.addListener('registrationError',()=>reject(Error('Device push registration failed. Check Firebase or Apple push configuration.'))));await PushNotifications.register()})().catch(reject);
   });
   if(session.get()?.user.Id!==userId)throw Error('Your account changed. Please retry.');
   const token=(platform==='android'?'fcm:':config.environment==='sandbox'?'apns-sandbox:':'apns:')+value;
   const previous=saved();
   await api.send('/users/devices',{deviceToken:token,platform,deviceName:'CDA Connect '+platform});
   if(previous?.userId===userId&&previous.token!==token)await api.send('/users/devices',{deviceToken:previous.token},'DELETE');
   localStorage.setItem(key,JSON.stringify({token,userId}));
  }finally{clearTimeout(timer);await Promise.all(handles.map(handle=>handle.remove()))}
 })().finally(()=>{registering=undefined});return registering;
}
export async function disconnectNativePush(){
 if(registering)await registering.catch(()=>{});
 const existing=saved();if(!existing)return;
 await api.send('/users/devices',{deviceToken:existing.token},'DELETE');
 await PushNotifications.unregister();await PushNotifications.removeAllDeliveredNotifications();localStorage.removeItem(key);
}
export function listenNativePush(navigate:(path:string)=>void,onNotification?:()=>void){
 if(!Capacitor.isNativePlatform())return()=>{};
 let disposed=false;const listeners:PluginListenerHandle[]=[];
 const keep=(handle:PluginListenerHandle)=>{if(disposed)void handle.remove();else listeners.push(handle)};
 void PushNotifications.addListener('pushNotificationReceived',()=>onNotification?.()).then(keep).catch(()=>{});
 void PushNotifications.addListener('pushNotificationActionPerformed',event=>{
  onNotification?.();
  const data=event.notification.data||{};const path=data.destination||data.url;
  navigate(typeof path==='string'&&/^\/(?!\/)/.test(path)&&!path.includes('\\')?path:'/notifications');
 }).then(keep).catch(()=>{});
 if(!optedOut())void enableNativePush(!nativeEnabled()).catch(()=>{});
 return()=>{disposed=true;void Promise.all(listeners.map(listener=>listener.remove()))};
}
export function NativePushSettings(){
 const[enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;void(async()=>{try{const status=await nativePushStatus();if(status.enabled){if(active)setEnabled(true)}else if(status.ready&&!optedOut()){await enableNativePush();if(active){setEnabled(true);setMessage('Notifications enabled on this device.')}}else if(active)setMessage(status.message)}catch(error){if(active)setMessage(error instanceof Error?error.message:'Unable to check notification setup. Reopen this page when online.')}finally{if(active)setReady(true)}})();return()=>{active=false}},[]);
 async function toggle(){setBusy(true);try{if(enabled){await disconnectNativePush();savePreference(false);setEnabled(false);setMessage('Notifications disabled on this device.')}else{await enableNativePush();savePreference(true);setEnabled(true);setMessage('Notifications enabled on this device.')}}catch(error){setMessage(error instanceof Error?error.message:'Unable to update notifications.')}finally{setBusy(false)}}
 return <div className="notification-push"><label className="settings-row account-switch-row"><span className="settings-row-icon"><Smartphone size={21}/></span><span className="settings-row-text"><strong>Push Notifications</strong><small>Receive notifications on this device</small></span><input type="checkbox" role="switch" checked={enabled} disabled={busy||!ready} onChange={()=>void toggle()}/></label>{(busy||message)&&<p className="privacy-note" role="status">{busy?'Updating device notifications…':message}</p>}</div>;
}
