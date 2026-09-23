import {Capacitor,registerPlugin} from '@capacitor/core';
export const NativeDevice=registerPlugin<{storage():Promise<{total:number;free:number}>;pushConfiguration():Promise<{configured:boolean;environment?:string}>}>('CdaDevice');
export async function storageEstimate(){
 if(!Capacitor.isNativePlatform())return await navigator.storage?.estimate?.()??{};
 const {total,free}=await NativeDevice.storage();
 if(!Number.isFinite(total)||!Number.isFinite(free)||total<=0||free<0||free>total)throw Error('Unable to read phone storage. Please reopen the app.');
 return {quota:total,usage:total-free,free};
}
