import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const auth=readFileSync(new URL('../src/auth.tsx',import.meta.url),'utf8');
const controls=readFileSync(new URL('../src/styles/controls.css',import.meta.url),'utf8');
const responsive=readFileSync(new URL('../src/styles/responsive.css',import.meta.url),'utf8');

test('password recovery requests a registered email address',()=>{
 const recovery=auth.slice(auth.indexOf('export function Recovery'));
 assert.match(recovery,/name="email" label="Registered email address" type="email"/);
 assert.match(recovery,/email:d\.email\.trim\(\)\.toLowerCase\(\)/);
 assert.doesNotMatch(recovery,/Registered phone number|<PhoneField/);
});

test('registration verifies email only and separates its verification buttons',()=>{
 const register=auth.slice(auth.indexOf('export function Register'),auth.indexOf('export function Recovery'));
 assert.match(register,/email-verification\/request/);
 assert.match(register,/verificationMethod:'email'/);
 assert.match(register,/className="registration-verification-actions"/);
 assert.doesNotMatch(register,/verification-switch|phone-verification|>SMS<|<PhoneField/);
 assert.match(controls,/\.registration-verification-actions\{display:grid;gap:14px\}/);
});

test('desktop auth branding and feature links share the requested layout',()=>{
 assert.match(auth,/<div className="welcome-entry-content"><BrandLink\/>/);
 assert.match(auth,/<div className="auth-panel-content"><BrandLink\/>/);
 assert.doesNotMatch(auth,/<(?:section className="welcome-story"|aside className="auth-visual")[^]*?<Link className="brand"/);
 assert.match(controls,/\.desktop-auth-brand\{display:flex/);
 assert.match(controls,/\.welcome-points\{width:100%;flex-wrap:nowrap/);
});

test('mobile login artwork reaches both screen edges',()=>{
 assert.match(responsive,/\.auth-page\.login-page>\.auth-panel\{padding-inline:0!important\}/);
});
