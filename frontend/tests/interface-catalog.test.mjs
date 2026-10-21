import test from 'node:test';
import assert from 'node:assert/strict';
import {interfaceEdits} from '../interfaceCatalog.mjs';
test('interface extraction includes conditional controls without translating user content or behavioral props',()=>{
 const source=`<div><button type="button" disabled={busy} aria-label={busy?'Saving…':'Save'}>{busy?'Saving…':'Save'}</button><p>{user.message}</p><p>{ready&&'Welcome back'}</p><p>Privacy &amp; safety</p><a href="/home">Home</a></div>`;
 const strings=interfaceEdits(source).map(edit=>edit.text);
 assert.deepEqual(strings,['Saving…','Save','Saving…','Save','Welcome back','Privacy & safety','Home']);
 assert.ok(!strings.includes('/home'));assert.ok(!strings.includes('user.message'));
});

test('Page title keys stay canonical for header matching while remaining in the translation catalog',()=>{const edits=interfaceEdits('<Page title={editing?"Edit community":"Create community"}><h2>Settings</h2></Page>');assert.deepEqual(edits.map(edit=>edit.text),['Edit community','Create community','Settings']);assert.deepEqual(edits.map(edit=>edit.translate!==false),[false,false,true])});
