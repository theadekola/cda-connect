import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const main=read('../src/main.tsx'),deletion=read('../src/AccountDeletionPage.tsx');
const manifest=read('../android/app/src/main/AndroidManifest.xml'),gradle=read('../android/app/build.gradle'),versions=read('../android/variables.gradle');

test('Google Play account deletion resource is public and provides an external request path',()=>{
 assert.match(main,/path="\/account-deletion" element={<AccountDeletionPage\/>}/);
 assert.match(main,/publicPath=.*'\/account-deletion'/);
 assert.match(deletion,/CDA Connect is provided by AAT Tech Ltd/);
 assert.match(deletion,/mailto:support@cdaconnect\.org/);
 assert.match(deletion,/What is deleted or retained/);
});

test('Android production configuration meets release security and signing requirements',()=>{
 assert.match(versions,/targetSdkVersion = 36/);
 assert.match(manifest,/android:allowBackup="false"/);
 assert.match(manifest,/android:usesCleartextTraffic="false"/);
 assert.doesNotMatch(manifest,/android\.permission\.WRITE_CONTACTS/);
 for(const name of ['CDA_ANDROID_KEYSTORE','CDA_ANDROID_KEY_ALIAS','CDA_ANDROID_STORE_PASSWORD','CDA_ANDROID_KEY_PASSWORD'])assert.match(gradle,new RegExp(name));
 assert.match(gradle,/Release signing is not configured/);
 assert.match(gradle,/versionName "1\.0\.0"/);
});
