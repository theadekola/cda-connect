import {loadInterfacePack} from './interfacePacks';
import {useSyncExternalStore} from 'react';
import {corePacks,interfaceLanguages} from './interfaceTranslations';
let locale='en-GB';try{const saved=localStorage.getItem('cda-interface-language');if(interfaceLanguages.includes(saved as typeof interfaceLanguages[number]))locale=saved!}catch{}

let revision=0;
const extended:Record<string,Record<string,string>>=Object.create(null);
const loading=new Map<string,Promise<void>>();
function ensurePack(language:string){if(loading.has(language))return;const task=loadInterfacePack(language).then(strings=>{extended[language]=strings;if(locale===language){revision++;listeners.forEach(fn=>fn())}}).catch(()=>{loading.delete(language)});loading.set(language,task)}
const listeners=new Set<()=>void>();
export const getLocale=()=>locale;
function regionalText(text:string,language:string){return language==='en-US'?text.replace(/\bneighbour/gi,m=>m[0]==='N'?'Neighbor':'neighbor').replace(/\bpersonalise\b/g,'personalize').replace(/\bcolour\b/g,'color').replace(/\bCustomise\b/g,'Customize'):text.replace(/\bCustomize\b/g,'Customise').replace(/\bPersonalized\b/g,'Personalised').replace(/\bpersonalize\b/g,'personalise')}
export function interfaceText(text:string,language=locale){const key=text.trim();const translated=extended[language]?.[key]??corePacks[language]?.[key];return translated?text.replace(key,()=>translated):regionalText(text,language)}
export function applyLanguage(value:string){if(!interfaceLanguages.includes(value as typeof interfaceLanguages[number]))return;const changed=locale!==value;locale=value;document.documentElement.lang=value;document.documentElement.dir=value==='ar'?'rtl':'ltr';try{localStorage.setItem('cda-interface-language',value)}catch{}ensurePack(value);if(changed)listeners.forEach(fn=>fn())}
export function useLocale(){useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},()=>locale+':'+revision);return locale}
export function interfacePack(language:string){return{version:1,language,strings:{...corePacks[language],...extended[language]}}}
