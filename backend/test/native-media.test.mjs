import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import helmet from 'helmet';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {allowMediaEmbedding} from '../dist/middleware/mediaResourcePolicy.js';

test('native WebViews can embed public uploads, including range responses, without relaxing API headers',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'cda-native-media-'));
 await writeFile(path.join(dir,'photo.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1cAAAAASUVORK5CYII=','base64'));
 const app=express();app.use(helmet());app.use('/uploads',express.static(dir,{setHeaders:allowMediaEmbedding}));app.get('/api/private',(_req,res)=>res.status(401).json({error:'Authentication required'}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const origin of ['https://localhost','capacitor://localhost']){
   const image=await fetch(base+'/uploads/photo.png',{headers:{Origin:origin}});assert.equal(image.status,200);assert.equal(image.headers.get('cross-origin-resource-policy'),'cross-origin');assert.match(image.headers.get('content-type'),/image\/png/);assert.equal(image.headers.get('x-content-type-options'),'nosniff');
   const range=await fetch(base+'/uploads/photo.png',{headers:{Origin:origin,Range:'bytes=0-7'}});assert.equal(range.status,206);assert.equal(range.headers.get('cross-origin-resource-policy'),'cross-origin');
   const denied=await fetch(base+'/api/private',{headers:{Origin:origin}});assert.equal(denied.status,401);assert.equal(denied.headers.get('cross-origin-resource-policy'),'same-origin');
  }
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
});
