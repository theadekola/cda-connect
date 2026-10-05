import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
test('deployed location service loads countries and Nigerian LGAs outside the source tree',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cda-location-release-'));
 await symlink(fileURLToPath(new URL('../node_modules',import.meta.url)),join(root,'node_modules'),'junction');
 await mkdir(join(root,'dist/services'),{recursive:true});
 await mkdir(join(root,'dist/utils'),{recursive:true});
 await writeFile(join(root,'package.json'),'{"type":"module"}');
 await cp(new URL('../dist/services/communityLocations.js',import.meta.url),join(root,'dist/services/communityLocations.js'));
 await cp(new URL('../dist/utils/errors.js',import.meta.url),join(root,'dist/utils/errors.js'));
 await cp(new URL('../data',import.meta.url),join(root,'data'),{recursive:true});
 const {locations,selectedLocation}=await import(pathToFileURL(join(root,'dist/services/communityLocations.js')));
 const all=await locations();assert.equal(Object.keys(all).length,250);
 assert.equal(Object.values(all.NG.states).reduce((n,s)=>n+s.areas.length,0),774);
 assert.equal((await selectedLocation('NG','NG025','Ikeja')).city,'Ikeja');
});

