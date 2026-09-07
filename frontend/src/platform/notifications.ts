import {LocalNotifications} from '@capacitor/local-notifications';
import {PushNotifications} from '@capacitor/push-notifications';
export type PermissionStatus='granted'|'denied'|'undetermined';
export type NotificationResponse=any;
export const AndroidImportance={MAX:5,HIGH:4,DEFAULT:3};
export async function requestPermissionsAsync():Promise<{status:PermissionStatus;granted:boolean}>{const p=await PushNotifications.requestPermissions();return {status:p.receive==='granted'?'granted':'denied',granted:p.receive==='granted'}}
export async function getPermissionsAsync():Promise<{status:PermissionStatus;granted:boolean}>{const p=await PushNotifications.checkPermissions();return {status:p.receive==='granted'?'granted':'denied',granted:p.receive==='granted'}}
export async function getPushTokenAsync(){return new Promise<{data:string}>((resolve,reject)=>{let done=false;const finish=(fn:()=>void)=>{if(done)return;done=true;fn()};void PushNotifications.addListener('registration',token=>finish(()=>resolve({data:token.value})));void PushNotifications.addListener('registrationError',error=>finish(()=>reject(error)));void PushNotifications.register().catch(error=>finish(()=>reject(error)))})}
export async function setNotificationHandler(_handler?:any){}
export async function setNotificationChannelAsync(_id?:string,_options?:any){return null}
export async function scheduleNotificationAsync({content,trigger}:any){const id=Date.now()%2147483647;await LocalNotifications.schedule({notifications:[{id,title:content?.title||'CDA Connect',body:content?.body||'',schedule:trigger?.date?{at:new Date(trigger.date)}:undefined,extra:content?.data}]});return String(id)}
export async function cancelScheduledNotificationAsync(id:string){await LocalNotifications.cancel({notifications:[{id:Number(id)}]})}
export function addNotificationResponseReceivedListener(listener:(event:any)=>void){let handle:any;LocalNotifications.addListener('localNotificationActionPerformed',e=>listener({notification:{request:{content:{data:e.notification.extra}}}})).then(h=>handle=h);return {remove:()=>handle?.remove()}}
export function addNotificationReceivedListener(listener:(event:any)=>void){let handle:any;LocalNotifications.addListener('localNotificationReceived',e=>listener(e)).then(h=>handle=h);return {remove:()=>handle?.remove()}}
export async function getLastNotificationResponseAsync(){return null}
