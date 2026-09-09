import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

Object.assign(process.env, { NODE_ENV: 'test', DB_SERVER: 'localhost', DB_NAME: 'test', DB_USER: 'test', DB_PASSWORD: 'test',
  JWT_ACCESS_SECRET: crypto.randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex') });
// Run the backend build before tests, so these exercise the code shipped to the VM.
const { signAccess, signRefresh, verifyAccess, verifyRefresh } = await import('../dist/utils/auth.js');
const user = { id: crypto.randomUUID(), email: 'test@example.invalid' };
test('login challenges and phone-verification tokens cannot authenticate API or socket requests', () => {
  for (const purpose of ['two-factor-login', 'phone-verification', 'password-reset']) {
    const challenge = jwt.sign({ ...user, purpose }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    assert.throws(() => verifyAccess(challenge));
  }
  assert.deepEqual(verifyAccess(signAccess(user)), user);
});
test('access and refresh tokens are not interchangeable', () => {
  assert.throws(() => verifyAccess(signRefresh(user)));
  assert.throws(() => verifyRefresh(signAccess(user)));
  assert.deepEqual(verifyRefresh(signRefresh(user)), user);
});
test('simultaneous logins produce distinct refresh session hashes', () => {
  assert.notEqual(signRefresh(user), signRefresh(user));
});
test('expired access tokens and malformed identities are rejected', () => {
  assert.throws(() => verifyAccess(jwt.sign({ ...user, purpose: 'access' }, process.env.JWT_ACCESS_SECRET, { expiresIn: -1 })));
  assert.throws(() => verifyAccess(jwt.sign({ purpose: 'access' }, process.env.JWT_ACCESS_SECRET)));
});
