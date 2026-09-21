import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('shared analytics tag preserves the queue and configures the supplied property once',()=>{
 const initial={event:'existing'},window={dataLayer:[initial]};
 runInNewContext(readFileSync(new URL('../public/google-tag.js',import.meta.url),'utf8'),{window,Date});
 assert.equal(window.dataLayer[0],initial);
 assert.equal(window.dataLayer[1][0],'js');
 assert.deepEqual(Array.from(window.dataLayer[2]),['config','G-HT1Y2WF4S7']);
 assert.equal(window.dataLayer.length,3);
});
