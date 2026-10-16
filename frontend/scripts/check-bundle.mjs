import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
const dist=resolve(dirname(fileURLToPath(import.meta.url)),'../dist'),html=readFileSync(resolve(dist,'index.html'),'utf8');
const scripts=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(\/assets\/[^"?]+\.js)"[^>]*>/g)].map(match=>match[1]);
if(!scripts.length)throw Error('No launch scripts were found in the production build');
let bytes=0,gzip=0;for(const path of new Set(scripts)){const contents=readFileSync(resolve(dist,'.'+path));bytes+=contents.length;gzip+=gzipSync(contents).length;}
console.log(`Launch JavaScript: ${(bytes/1024).toFixed(1)} KiB, ${(gzip/1024).toFixed(1)} KiB gzip`);
if(gzip>250*1024)throw Error('Launch JavaScript exceeds the 250 KiB gzip budget. Keep specialist modules lazy.');
