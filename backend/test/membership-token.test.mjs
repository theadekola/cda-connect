import {test} from 'node:test';
import assert from 'node:assert/strict';
import {membershipToken} from '../dist/services/membershipToken.js';
const token='a'.repeat(32),path='/community/11111111-1111-4111-a111-111111111111/membership-card';
test('accepts existing card credentials and identity QR links',()=>{assert.equal(membershipToken('CDACONNECT:'+token),token);assert.equal(membershipToken('https://cdaconnect.org'+path+'#member='+token),token)});
test('rejects foreign links, malformed credentials and unrelated pages',()=>{for(const payload of ['https://evil.test'+path+'#member='+token,'https://cdaconnect.org/profile#member='+token,'CDACONNECT:short','https://cdaconnect.org'+path+'#member=short','https://cdaconnect.org.evil.test'+path+'#member='+token])assert.equal(membershipToken(payload),null)});
test('accepts card-generated links with uppercase and mixed-case community IDs without changing token case',()=>{
 const credential='AbCdEfGhIjKlMnOpQrStUvWxYz0123_-';
 assert.equal(credential.length,32);
 for(const id of ['12345678-ABCD-4ABC-ABCD-123456789ABC','12345678-AbCd-4aBc-aBcD-123456789aBc']){
  const qr='https://cdaconnect.org/community/'+id+'/membership-card#member='+encodeURIComponent(credential);
  assert.equal(membershipToken(qr),credential);
  assert.equal(membershipToken(' \n'+qr+'\r\n'),credential);
 }
 assert.equal(membershipToken(' CDACONNECT:'+credential+'\n'),credential);
});
test('rejects malformed community IDs and misleading URLs',()=>{
 for(const id of ['-'.repeat(36),'Z2345678-ABCD-4ABC-ABCD-123456789ABC','12345678ABCD4ABCABCD123456789ABC'])assert.equal(membershipToken('https://cdaconnect.org/community/'+id+'/membership-card#member='+token),null);
 for(const prefix of ['http://cdaconnect.org','https://cdaconnect.org.evil.test','https://cdaconnect.org@evil.test'])assert.equal(membershipToken(prefix+path+'#member='+token),null);
});
