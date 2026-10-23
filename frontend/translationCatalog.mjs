import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
import {interfaceEdits} from './interfaceCatalog.mjs';
export const languages=['fr','es','ar','ha','yo','ig','pt','de'];
export async function translationCatalog(root){
 const strings=new Set();
 async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=resolve(dir,entry.name);if(entry.isDirectory())await visit(file);else if(entry.name.endsWith('.tsx'))for(const edit of interfaceEdits(await readFile(file,'utf8'),file)){const text=edit.text.trim();if(/\p{L}/u.test(text))strings.add(text)}}}
 await visit(resolve(root,'src'));
 const source=await readFile(resolve(root,'src/interfaceTranslations.ts'),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {corePacks}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 for(const pack of Object.values(corePacks))for(const key of Object.keys(pack))strings.add(key);
 return{catalog:[...strings].sort(),corePacks};
}
export function missingTranslations(catalog,pack){return catalog.filter(key=>typeof pack[key]!=='string'||!pack[key].trim())}
