import {secureGet,secureSet} from '../lib/storage';
import { create } from 'zustand';

export type ThemeMode='system'|'light'|'dark';
export type TextScale='normal'|'large'|'xlarge';
export type AppLanguage='en'|'fr'|'es'|'pt'|'ar'|'yo'|'ig'|'ha';
export type AccentColor='#0F8A43'|'#08723A'|'#11243F';

export interface AccessibilityPrefs {
  themeMode:ThemeMode;
  highContrast:boolean;
  boldText:boolean;
  textScale:TextScale;
  reducedMotion:boolean;
  largeTouchTargets:boolean;
  captionsEnabled:boolean;
  autoTranscripts:boolean;
  textToSpeech:boolean;
  language:AppLanguage;
  autoTranslate:boolean;
  simpleLanguage:boolean;
  accentColor:AccentColor;
  compactMode:boolean;
  roundCorners:boolean;
  showCommunityCovers:boolean;
  colorBlindFriendly:boolean;
  dateFormat:'DMY'|'MDY'|'YMD';
  timeFormat:'12'|'24';
  firstDayOfWeek:'Monday'|'Sunday';
  numberFormat:'comma-dot'|'dot-comma';
  translateComments:boolean;
  preferredContentLanguages:AppLanguage[];
}

const defaults:AccessibilityPrefs={themeMode:'light',highContrast:false,boldText:false,textScale:'normal',reducedMotion:false,largeTouchTargets:true,captionsEnabled:true,autoTranscripts:true,textToSpeech:false,language:'en',autoTranslate:false,simpleLanguage:false,accentColor:'#0F8A43',compactMode:false,roundCorners:true,showCommunityCovers:true,colorBlindFriendly:false,dateFormat:'DMY',timeFormat:'12',firstDayOfWeek:'Monday',numberFormat:'comma-dot',translateComments:true,preferredContentLanguages:['fr','es']};
// v2 intentionally resets the old device-specific colour selection. Expo Go and
// web now start from the same CDA light/green/navy palette on first launch.
const KEY='cda-connect-accessibility-v2';

type Store=AccessibilityPrefs&{hydrated:boolean;draftLanguage:AppLanguage|null;load:()=>Promise<void>;update:(patch:Partial<AccessibilityPrefs>)=>Promise<void>;selectLanguage:(language:AppLanguage)=>void;saveLanguage:()=>Promise<void>;reset:()=>Promise<void>};
export const useAccessibility=create<Store>((set,get)=>({
  ...defaults,hydrated:false,draftLanguage:null,
  load:async()=>{try{const raw=await secureGet(KEY);set({...defaults,...(raw?JSON.parse(raw):{}),hydrated:true});}catch{set({...defaults,hydrated:true});}},
  update:async(patch)=>{const next={...get(),...patch};set(patch);const persist:Object={};for(const k of Object.keys(defaults)) (persist as any)[k]=(next as any)[k];await secureSet(KEY,JSON.stringify(persist));},
  selectLanguage:(language)=>set({draftLanguage:language}),
  saveLanguage:async()=>{const language=get().draftLanguage??get().language;const next={...get(),language,autoTranslate:language!=='en',translateComments:true};set({language,draftLanguage:null,autoTranslate:language!=='en',translateComments:true});const persist:Object={};for(const k of Object.keys(defaults)) (persist as any)[k]=(next as any)[k];await secureSet(KEY,JSON.stringify(persist));},
  reset:async()=>{set(defaults);await secureSet(KEY,JSON.stringify(defaults));}
}));

export const textScaleValue=(s:TextScale)=>s==='large'?1.18:s==='xlarge'?1.34:1;
