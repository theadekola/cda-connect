import {secureGet,secureSet} from '../lib/storage';
import { create } from 'zustand';

export type ThemeMode='system'|'light'|'dark';
export type TextScale='normal'|'large'|'xlarge';
export type AppLanguage='en'|'fr'|'es'|'pt'|'ar'|'yo'|'ig'|'ha';

export interface AccessibilityPrefs {
  themeMode:ThemeMode;
  highContrast:boolean;
  textScale:TextScale;
  reducedMotion:boolean;
  largeTouchTargets:boolean;
  captionsEnabled:boolean;
  autoTranscripts:boolean;
  textToSpeech:boolean;
  language:AppLanguage;
  autoTranslate:boolean;
  simpleLanguage:boolean;
}

const defaults:AccessibilityPrefs={themeMode:'system',highContrast:false,textScale:'normal',reducedMotion:false,largeTouchTargets:true,captionsEnabled:true,autoTranscripts:true,textToSpeech:false,language:'en',autoTranslate:false,simpleLanguage:false};
const KEY='cda-connect-accessibility-v1';

type Store=AccessibilityPrefs&{hydrated:boolean;load:()=>Promise<void>;update:(patch:Partial<AccessibilityPrefs>)=>Promise<void>;reset:()=>Promise<void>};
export const useAccessibility=create<Store>((set,get)=>({
  ...defaults,hydrated:false,
  load:async()=>{try{const raw=await secureGet(KEY);set({...defaults,...(raw?JSON.parse(raw):{}),hydrated:true});}catch{set({...defaults,hydrated:true});}},
  update:async(patch)=>{const next={...get(),...patch};set(patch);const persist:Object={};for(const k of Object.keys(defaults)) (persist as any)[k]=(next as any)[k];await secureSet(KEY,JSON.stringify(persist));},
  reset:async()=>{set(defaults);await secureSet(KEY,JSON.stringify(defaults));}
}));

export const textScaleValue=(s:TextScale)=>s==='large'?1.18:s==='xlarge'?1.34:1;
