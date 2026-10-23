import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceFingerprint} from '../buildIdentity.mjs';
test('release identity ignores checkout line endings but changes with source or binary assets',()=>{
 const root=mkdtempSync(join(tmpdir(),'cda-source-'));
 try{mkdirSync(join(root,'src'));mkdirSync(join(root,'public'));const source=join(root,'src','app.ts');writeFileSync(source,'const x=1;\n');const first=sourceFingerprint(root);writeFileSync(source,'const x=1;\r\n');assert.equal(sourceFingerprint(root),first);writeFileSync(join(root,'public','logo.png'),Buffer.from([1,2,3]));const image=sourceFingerprint(root);assert.notEqual(image,first);writeFileSync(source,'const x=2;\n');assert.notEqual(sourceFingerprint(root),image)}finally{rmSync(root,{recursive:true,force:true})}
});
