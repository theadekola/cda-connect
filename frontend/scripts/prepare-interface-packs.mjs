// Only developer-authored interface strings are sent. Never send a user record.
// CDA_INTERFACE_TRANSLATION_URL must implement {task,text,targetLanguage} -> {text}.
// Run once per language, review the JSON, and commit it before making a release.
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {translationCatalog,languages as supported} from '../translationCatalog.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const language=process.argv[2];
if(language&&!supported.includes(language))throw Error('Choose one of: '+supported.join(', '));
const {catalog,corePacks}=await translationCatalog(root);
if(!language){console.log(`${catalog.length} static interface strings. Run with a language code to prepare a reviewed pack.`);process.exit(0)}
if(!process.env.CDA_INTERFACE_TRANSLATION_URL)throw Error('Set CDA_INTERFACE_TRANSLATION_URL to your translation provider endpoint.');
const url=new URL(process.env.CDA_INTERFACE_TRANSLATION_URL);
if(url.protocol!=='https:'||url.username||url.password)throw Error('Use an HTTPS translation endpoint without credentials in its URL.');
const dir=resolve(root,'src/interfacePacks'),file=resolve(dir,language+'.json');
let previous={...corePacks[language]};try{previous={...previous,...JSON.parse(await readFile(file,'utf8'))}}catch(error){if(error.code!=='ENOENT')throw error}
await mkdir(dir,{recursive:true});
const output=Object.create(null);
for(const text of catalog){
 if(typeof previous[text]==='string'&&previous[text].trim()){output[text]=previous[text];continue}
 const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',...(process.env.CDA_INTERFACE_TRANSLATION_KEY?{authorization:'Bearer '+process.env.CDA_INTERFACE_TRANSLATION_KEY}:{})},body:JSON.stringify({task:'translate',text,targetLanguage:language})});
 if(!response.ok)throw Error(`Translation provider failed (${response.status}); completed entries remain saved.`);
 const data=await response.json(),value=data?.text??data?.translation??data?.result;
 if(typeof value!=='string'||!value.trim()||value.length>50000)throw Error('Translation provider returned an invalid string.');
 output[text]=value;
 // Atomic checkpoints allow a failed run to resume without resending completed text.
 await writeFile(file+'.tmp',JSON.stringify({...previous,...output},null,2)+'\n');await rename(file+'.tmp',file);
}
await writeFile(file+'.tmp',JSON.stringify(output,null,2)+'\n');await rename(file+'.tmp',file);
console.log(`${language}: ${catalog.length} strings prepared. Review translations with a fluent speaker before release.`);
