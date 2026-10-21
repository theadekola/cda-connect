import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// Resolve exactly the copy used by the production SQL driver.
const driver=createRequire(require.resolve('mssql'));
const tedious=createRequire(driver.resolve('tedious'));
const {sprintf,vsprintf}=tedious('sprintf-js');
test('SQL driver formatting caps hostile precision without throwing RangeError',()=>{
 for(const type of ['e','f','g'])for(const precision of ['101','999999999','9'.repeat(400)]){
  const result=sprintf('%.'+precision+type,1.25);
  assert.equal(typeof result,'string');assert.ok(result.length<=110);
 }
 assert.equal(sprintf('%.0g',1.25),'1');
});
test('bounded formatting preserves SQL value and diagnostic formatting',()=>{
 assert.equal(sprintf('%.2f',1.256),'1.26');assert.equal(sprintf('%.2e',1.25),'1.25e+0');assert.equal(sprintf('%.3g',1.256),'1.26');
 assert.equal(sprintf('%04d-%02d-%02d',2026,10,21),'2026-10-21');assert.equal(vsprintf('%s: %d',['SQL',17]),'SQL: 17');
});
