import AsyncStorage from '@/platform/browser-storage';
import {getNetworkState} from '@/platform/network';
import { api } from './api';
const CACHE='cda-cache:'; const QUEUE='cda-offline-queue';
export async function cacheSet(key:string,value:any){await AsyncStorage.setItem(CACHE+key,JSON.stringify({value,at:Date.now()}));}
export async function cacheGet<T>(key:string):Promise<T|null>{const raw=await AsyncStorage.getItem(CACHE+key);if(!raw)return null;try{return JSON.parse(raw).value as T}catch{return null}}
export async function queueMutation(method:'post'|'patch'|'put'|'delete',url:string,data?:any){const q=JSON.parse(await AsyncStorage.getItem(QUEUE)||'[]');q.push({id:Date.now()+'-'+Math.random(),method,url,data,createdAt:Date.now()});await AsyncStorage.setItem(QUEUE,JSON.stringify(q));return q.length;}
export async function flushQueue(){const state=await getNetworkState();if(!state.isConnected)return {flushed:0};const q:any[]=JSON.parse(await AsyncStorage.getItem(QUEUE)||'[]');const keep:any[]=[];let flushed=0;for(const x of q){try{await (api as any)[x.method](x.url,x.data);flushed++}catch{keep.push(x)}}await AsyncStorage.setItem(QUEUE,JSON.stringify(keep));return {flushed,remaining:keep.length};}
export async function isOnline(){return !!(await getNetworkState()).isConnected}
