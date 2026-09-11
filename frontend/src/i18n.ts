import {useSyncExternalStore} from 'react';
import catalog from 'virtual:cda-interface-pack';
let locale='en-GB';try{const saved=localStorage.getItem('cda-interface-language');if(saved==='en-US')locale=saved}catch{}

const listeners=new Set<()=>void>();
export const getLocale=()=>locale;
function regionalText(text:string,language:string){return language==='en-US'?text.replace(/\bneighbour/gi,m=>m[0]==='N'?'Neighbor':'neighbor').replace(/\bpersonalise\b/g,'personalize').replace(/\bcolour\b/g,'color').replace(/\bCustomise\b/g,'Customize'):text.replace(/\bCustomize\b/g,'Customise').replace(/\bPersonalized\b/g,'Personalised').replace(/\bpersonalize\b/g,'personalise')}
const bundledPacks:Record<string,Record<string,string>>=Object.fromEntries(['en-GB','en-US'].map(language=>[language,Object.fromEntries(catalog.map(text=>[text,regionalText(text,language)]))]));
export function interfaceText(text:string,language=locale){return bundledPacks[language]?.[text]??regionalText(text,language)}
export function applyLanguage(value:string){if(value!=='en-US'&&value!=='en-GB')return;locale=value;document.documentElement.lang=value;try{localStorage.setItem('cda-interface-language',value)}catch{}listeners.forEach(fn=>fn())}
export function useLocale(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},getLocale)}
export function interfacePack(language:string){return{version:1,language,strings:bundledPacks[language]||{}}}
