import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/assetUrl.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {resolveAssetUrl}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const api='https://cdaconnect.org/api/v1';
for(const origin of ['https://localhost','capacitor://localhost','https://cdaconnect.org']){
 test('uploaded images resolve on '+origin,()=>{
  for(const value of ['/uploads/photo.jpg','http://localhost:4000/uploads/photo.jpg','https://old.example/uploads/photo.jpg'])assert.equal(resolveAssetUrl(value,api,origin),'https://cdaconnect.org/uploads/photo.jpg');
  assert.equal(resolveAssetUrl('/uploads/photo.jpg?v=2#preview',api,origin),'https://cdaconnect.org/uploads/photo.jpg?v=2#preview');
  assert.equal(resolveAssetUrl('https://cdn.example/photo.jpg',api,origin),'https://cdn.example/photo.jpg');
  assert.equal(resolveAssetUrl('data:image/png;base64,AA==',api,origin),'data:image/png;base64,AA==');
  assert.equal(resolveAssetUrl('blob:https://localhost/id',api,origin),'blob:https://localhost/id');
 });
}
