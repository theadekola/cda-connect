import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {callRelayServers} from '../dist/services/callRelay.js';
const config={NODE_ENV:'production',RTC_ICE_SERVERS:'[{"urls":"stun:stun.l.google.com:19302"}]',RTC_TURN_URLS:'turn:relay.test.invalid:3478?transport=udp,turns:relay.test.invalid:5349?transport=tcp',RTC_TURN_SECRET:'a'.repeat(64),RTC_TURN_TTL_SECONDS:3600};
test('TURN credentials expire, identify the member, and match coturn HMAC authentication',()=>{
 const servers=callRelayServers(config,'member-a',1700000000000),relay=servers.at(-1);
 assert.equal(relay.username,'1700003600:member-a');
 assert.equal(relay.credential,createHmac('sha1',config.RTC_TURN_SECRET).update(relay.username).digest('base64'));
 assert.notEqual(relay.credential,callRelayServers(config,'member-b',1700000000000).at(-1).credential);
 assert.notEqual(relay.credential,callRelayServers(config,'member-a',1700000010000).at(-1).credential);
 assert.ok(!JSON.stringify(servers).includes(config.RTC_TURN_SECRET));
});
test('missing secrets, placeholder hosts, unsafe URLs, and invalid lifetimes fail closed',()=>{
 for(const change of [{RTC_TURN_SECRET:undefined},{RTC_TURN_SECRET:'short'},{RTC_TURN_URLS:'turn:turn.example.com:3478'},{RTC_TURN_URLS:'https://relay.test.invalid'},{RTC_TURN_URLS:'turn:relay.test.invalid:99999'},{RTC_TURN_TTL_SECONDS:0}])assert.throws(()=>callRelayServers({...config,...change},'member'),/configuration is invalid/);
 assert.throws(()=>callRelayServers({...config,RTC_TURN_SECRET:undefined,RTC_TURN_URLS:undefined},'member'),/not configured/);
});
