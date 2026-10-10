import {Capacitor,registerPlugin} from '@capacitor/core';
export type NativeAudioRoute='earpiece'|'speaker'|'bluetooth';
export type NativeAudioRoutes={available:NativeAudioRoute[];active:NativeAudioRoute;labels?:Partial<Record<NativeAudioRoute,string>>};
export const NativeDevice=registerPlugin<{
 storage():Promise<{total:number;free:number}>;
 pushConfiguration():Promise<{configured:boolean;environment?:string}>;
 beginCall(options:{speaker:boolean}):Promise<NativeAudioRoutes>;
 audioRoutes():Promise<NativeAudioRoutes>;
 setAudioRoute(options:{route:NativeAudioRoute}):Promise<NativeAudioRoutes>;
 endCall():Promise<void>;
 startRingtone():Promise<void>;
 stopRingtone():Promise<void>;
}>('CdaDevice');
export async function storageEstimate(){
 if(!Capacitor.isNativePlatform())return await navigator.storage?.estimate?.()??{};
 const {total,free}=await NativeDevice.storage();
 if(!Number.isFinite(total)||!Number.isFinite(free)||total<=0||free<0||free>total)throw Error('Unable to read phone storage. Please reopen the app.');
 return {quota:total,usage:total-free,free};
}
