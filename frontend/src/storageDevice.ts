import {Capacitor} from '@capacitor/core';
import {Network} from '@capacitor/network';
import {useSyncExternalStore} from 'react';
import {storageDefaults,canRefresh,type StoragePreferences} from './storagePolicy';
export type {StoragePreferences} from './storagePolicy';
const key='cda-device-storage-preferences';let current=storageDefaults;try{const value=JSON.parse(localStorage.getItem(key)||'{}');current={...storageDefaults};for(const k of ['dataSaver','syncMobile'] as const)if(typeof value[k]==='boolean')current[k]=value[k];for(const k of ['photos','videos','documents','audio'] as const)if(['WIFI','ALWAYS','NEVER'].includes(value[k]))current[k]=value[k]}catch{}
const listeners=new Set<()=>void>();export function saveStoragePreferences(value:Partial<StoragePreferences>){const next={...current,...value};localStorage.setItem(key,JSON.stringify(next));current=next;listeners.forEach(fn=>fn())}export function useStoragePreferences(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},()=>current)}
let nativeNetwork='unknown';
const networkListeners=new Set<()=>void>();
if(Capacitor.isNativePlatform()){const update=(status:{connected:boolean;connectionType:string})=>{nativeNetwork=status.connected?status.connectionType:'none';networkListeners.forEach(fn=>fn())};void Network.addListener('networkStatusChange',update).catch(()=>{});void Network.getStatus().then(update).catch(()=>{});}
export function connectionType(){if(Capacitor.isNativePlatform())return nativeNetwork;return (navigator as Navigator&{connection?:{type?:string}}).connection?.type||'unknown'}
export function useConnectionType(){return useSyncExternalStore(fn=>{networkListeners.add(fn);const conn=(navigator as Navigator&{connection?:EventTarget}).connection;conn?.addEventListener('change',fn);return()=>{networkListeners.delete(fn);conn?.removeEventListener('change',fn)}},connectionType)}
export function refreshInterval(normal:number):number|false{return canRefresh(current,connectionType())?(current.dataSaver?Math.max(normal,60000):normal):false}
export function startUsageMeter(){if(!('PerformanceObserver'in window))return;try{const observer=new PerformanceObserver(list=>{const month=new Date().toISOString().slice(0,7),key='cda-network-usage-'+month;try{const data=JSON.parse(localStorage.getItem(key)||'{"bytes":0,"reported":0,"unreported":0}');for(const item of list.getEntries() as PerformanceResourceTiming[]){if(!item.name.startsWith('http'))continue;if(item.transferSize>0){data.bytes+=item.transferSize;data.reported++}else data.unreported++}localStorage.setItem(key,JSON.stringify(data))}catch{}});observer.observe({type:'resource',buffered:true})}catch{}}
export function bytes(value:number|undefined){if(value==null||!Number.isFinite(value))return 'Unavailable';if(value<1024)return value+' B';const units=['KB','MB','GB'],n=Math.min(2,Math.floor(Math.log(value)/Math.log(1024))-1);return(value/1024**(n+1)).toFixed(1)+' '+units[n]}
