import {useSyncExternalStore} from 'react';
import {corePacks,interfaceLanguages} from './interfaceTranslations';
let locale='en-GB';try{const saved=localStorage.getItem('cda-interface-language');if(interfaceLanguages.includes(saved as typeof interfaceLanguages[number]))locale=saved!}catch{}

const listeners=new Set<()=>void>();
export const getLocale=()=>locale;
function regionalText(text:string,language:string){return language==='en-US'?text.replace(/\bneighbour/gi,m=>m[0]==='N'?'Neighbor':'neighbor').replace(/\bpersonalise\b/g,'personalize').replace(/\bcolour\b/g,'color').replace(/\bCustomise\b/g,'Customize'):text.replace(/\bCustomize\b/g,'Customise').replace(/\bPersonalized\b/g,'Personalised').replace(/\bpersonalize\b/g,'personalise')}
export function interfaceText(text:string,language=locale){const key=text.trim();const translated=corePacks[language]?.[key];return translated?text.replace(key,translated):regionalText(text,language)}
export function applyLanguage(value:string){if(!interfaceLanguages.includes(value as typeof interfaceLanguages[number]))return;const changed=locale!==value;locale=value;document.documentElement.lang=value;document.documentElement.dir=value==='ar'?'rtl':'ltr';try{localStorage.setItem('cda-interface-language',value)}catch{}if(changed)listeners.forEach(fn=>fn())}
export function useLocale(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},getLocale)}
export function interfacePack(language:string){return{version:1,language,strings:corePacks[language]||{}}}
