import {test} from 'node:test';
import assert from 'node:assert/strict';
import {membershipToken} from '../dist/services/membershipToken.js';
const token='a'.repeat(32),path='/community/11111111-1111-4111-a111-111111111111/membership-card';
test('accepts existing card credentials and identity QR links',()=>{assert.equal(membershipToken('CDACONNECT:'+token),token);assert.equal(membershipToken('https://cdaconnect.org'+path+'#member='+token),token)});
test('rejects foreign links, malformed credentials and unrelated pages',()=>{for(const payload of ['https://evil.test'+path+'#member='+token,'https://cdaconnect.org/profile#member='+token,'CDACONNECT:short','https://cdaconnect.org'+path+'#member=short','https://cdaconnect.org.evil.test'+path+'#member='+token])assert.equal(membershipToken(payload),null)});
