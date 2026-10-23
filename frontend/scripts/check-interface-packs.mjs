import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {translationCatalog,languages,missingTranslations} from '../translationCatalog.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const {catalog,corePacks}=await translationCatalog(root);
const requested=process.argv.slice(2);if(requested.some(code=>!languages.includes(code)))throw Error('Choose languages: '+languages.join(', '));
for(const code of requested.length?requested:languages){
 const pack={...corePacks[code],...JSON.parse(await readFile(resolve(root,'src/interfacePacks/'+code+'.json'),'utf8'))};
 const missing=missingTranslations(catalog,pack);console.log(`${code}: ${catalog.length-missing.length}/${catalog.length} static strings; ${missing.length} missing`);
 if(missing.length){console.log('  Examples: '+missing.slice(0,3).join(' | '));process.exitCode=1}
}
console.log('Coverage is not a substitute for fluent review. User content uses separate provider translation.');
