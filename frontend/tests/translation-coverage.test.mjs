import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {translationCatalog,missingTranslations} from '../translationCatalog.mjs';
test('coverage includes nested pages and common runtime keys, and rejects empty translations',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cda-language-'));
 try{await mkdir(join(root,'src/nested'),{recursive:true});await writeFile(join(root,'src/nested/Page.tsx'),'<h1>Nested heading</h1>');await writeFile(join(root,'src/interfaceTranslations.ts'),"export const corePacks={fr:{'Common label':'Libellé'}};");const {catalog}=await translationCatalog(root);assert.deepEqual(catalog,['Common label','Nested heading']);assert.deepEqual(missingTranslations(catalog,{'Common label':'Libellé','Nested heading':' '}),['Nested heading'])}finally{await rm(root,{recursive:true,force:true})}
});
