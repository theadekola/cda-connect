import {create} from 'zustand';
import {secureGet,secureSet} from '../lib/storage';

const KEY='cda-connect-read-notifications-v1';
type Store={readIds:Record<string,boolean>;hydrated:boolean;load:()=>Promise<void>;mark:(ids:string[])=>Promise<void>;markAll:(ids:string[])=>Promise<void>};

export const notificationKey=(item:{Id:string;NotificationType:string})=>`${item.NotificationType}:${item.Id}`;

export const useNotificationReads=create<Store>((set,get)=>({
 readIds:{},hydrated:false,
 load:async()=>{if(get().hydrated)return;try{const raw=await secureGet(KEY);set({readIds:raw?JSON.parse(raw):{},hydrated:true})}catch{set({readIds:{},hydrated:true})}},
 mark:async ids=>{const next={...get().readIds};ids.forEach(id=>{next[id]=true});set({readIds:next});await secureSet(KEY,JSON.stringify(next))},
 markAll:async ids=>{const next={...get().readIds};ids.forEach(id=>{next[id]=true});set({readIds:next});await secureSet(KEY,JSON.stringify(next))},
}));
