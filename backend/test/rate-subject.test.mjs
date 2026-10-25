import test from 'node:test';import assert from 'node:assert/strict';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {rateLimitSubject}=await import('../dist/middleware/rateLimit.js'),{signAccess,signRefresh}=await import('../dist/utils/auth.js');
test('members sharing a network use independent rate buckets; forged and refresh tokens retain IP limits',()=>{
 const a={id:'account-a',email:'a@example.test'},b={id:'account-b',email:'b@example.test'},ip='192.0.2.1';
 assert.notEqual(rateLimitSubject('Bearer '+signAccess(a),ip),rateLimitSubject('Bearer '+signAccess(b),ip));
 for(const token of [undefined,'Bearer forged','Bearer '+signRefresh(a)])assert.equal(rateLimitSubject(token,ip),'ip:'+ip);
});
