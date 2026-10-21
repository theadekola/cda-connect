import type {Plugin} from 'vite';
import {interfaceEdits} from './interfaceCatalog.mjs';
export function languagePlugin():Plugin{return{
 name:'cda-interface-language',enforce:'pre',
 transform(code,id){
  if(!id.replaceAll('\\','/').includes('/src/')||!id.endsWith('.tsx'))return;
  const edits=interfaceEdits(code,id).filter(edit=>edit.translate!==false);if(!edits.length)return;
  for(const edit of edits.sort((a,b)=>b.start-a.start)){
   const translated='__cdaText('+JSON.stringify(edit.text)+')';
   code=code.slice(0,edit.start)+(edit.attribute?'{'+translated+'}':translated)+code.slice(edit.end);
  }
  return{code:"import {interfaceText as __cdaText} from '/src/i18n';\n"+code,map:null};
 }
}}
