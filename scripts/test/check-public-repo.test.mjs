import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPublicFile} from '../check-public-repo.mjs';
const scan=(path,text)=>inspectPublicFile(path,Buffer.from(text));
const policy=[10,0,0,0].join('.')+'-'+[10,255,255,255].join('.');
const privateHost=[10,23,45,67].join('.');
test('exact public TURN deny rules pass, but only in the firewall source and its test',()=>{
 for(const path of ['deploy/setup-turn.py','deploy/test_setup_turn.py']){
  assert.deepEqual(scan(path,'"'+policy+'"'),[]);
  assert.deepEqual(scan(path,'"denied-peer-ip='+policy+'\\n"'),[]);
 }
 assert.equal(scan('backend/src/other.ts','"'+policy+'"').length,1);
});
test('a deny policy never hides a private host on the same line or elsewhere',()=>{
 for(const content of ['"'+policy+'" "'+privateHost+'"','"'+policy+'"\n"'+privateHost+'"',privateHost])assert.equal(scan('deploy/setup-turn.py',content).length,1);
});
test('other private ranges and non-literal policy text remain blocked',()=>{
 assert.equal(scan('deploy/setup-turn.py',policy).length,1);
 for(const host of [[192,168,12,34],[172,20,12,34]])assert.equal(scan('deploy/test_setup_turn.py',host.join('.')).length,1);
});
test('credential files, private keys and user paths remain blocked',()=>{
 assert.equal(scan('config/.env','TOKEN=example').length,1);
 assert.deepEqual(scan('backend/.env.example','TOKEN=example'),[]);
 assert.equal(scan('source.ts',['-----BEGIN','PRIVATE KEY-----'].join(' ')).length,1);
 assert.equal(scan('source.ts','/'+['Users','someone','project'].join('/')).length,1);
});
