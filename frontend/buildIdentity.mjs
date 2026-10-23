import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';
export function sourceFingerprint(root){
 const files=[];
 function visit(path){for(const entry of readdirSync(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isDirectory())visit(file);else if(entry.isFile())files.push(file)}}
 for(const dir of ['src','public'])if(existsSync(join(root,dir)))visit(join(root,dir));
 for(const file of ['index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json','languagePlugin.ts','interfaceCatalog.mjs','translationCatalog.mjs','buildIdentity.mjs','capacitor.config.ts'])if(existsSync(join(root,file)))files.push(join(root,file));
 const hash=createHash('sha256');
 for(const file of files.sort((a,b)=>{const x=relative(root,a).replaceAll('\\','/'),y=relative(root,b).replaceAll('\\','/');return x<y?-1:x>y?1:0})){const name=relative(root,file).replaceAll('\\','/');let bytes=readFileSync(file);if(/\.(?:tsx?|m?js|json|css|html|svg|webmanifest)$/.test(name))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));hash.update(name+'\0'+bytes.length+'\0');hash.update(bytes)}
 return hash.digest('hex');
}
export function releaseMetadata(root){return{schema:1,sourceId:sourceFingerprint(root),version:JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version}}
export function releasePlugin(metadata){return{name:'cda-release-identity',transformIndexHtml(){return[{tag:'meta',attrs:{name:'cda-source-id',content:metadata.sourceId},injectTo:'head'}]},generateBundle(){this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify(metadata)+'\n'})}}}
