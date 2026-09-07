import { Platform } from '@/platform/react-native';
import * as SecureStore from '@/platform/secure-store';

const memory = new Map<string,string>();

function webStorage(){
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {}
  return null;
}

export async function secureGet(key:string){
  if(Platform.OS==='web') return webStorage()?.getItem(key) ?? memory.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}
export async function secureSet(key:string,value:string){
  if(Platform.OS==='web'){
    const s=webStorage(); if(s)s.setItem(key,value); else memory.set(key,value); return;
  }
  await SecureStore.setItemAsync(key,value);
}
export async function secureDelete(key:string){
  if(Platform.OS==='web'){
    const s=webStorage(); if(s)s.removeItem(key); memory.delete(key); return;
  }
  await SecureStore.deleteItemAsync(key);
}
