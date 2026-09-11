import {Capacitor} from '@capacitor/core';
import {useEffect,useRef,useState} from 'react';
import {api,session,str,type RecordData} from './api';
import {useStoragePreferences,useConnectionType} from './storageDevice';
import {canLoadMedia} from './storagePolicy';
export function PostMedia({post}:{post:RecordData}){
 const preferences=useStoragePreferences(),connection=useConnectionType(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[manual,setManual]=useState(false),[visible,setVisible]=useState(false),[documentReady,setDocumentReady]=useState(false),ref=useRef<HTMLDivElement>(null),documentBlob=useRef<{url:string;blob:Blob}|null>(null);
 const url=api.asset(str(post.MediaUrl)),type=str(post.MediaType),kind=type.startsWith('image/')?'photos':type.startsWith('video/')?'videos':type.startsWith('audio/')?'audio':'documents',allowed=Boolean(post.AllowDownloads)||post.CreatedBy===session.get()?.user.Id,load=manual||(visible&&canLoadMedia(preferences,kind,connection));
 useEffect(()=>{const observer=new IntersectionObserver(entries=>setVisible(entries.some(e=>e.isIntersecting)));if(ref.current)observer.observe(ref.current);return()=>observer.disconnect()},[]);
 useEffect(()=>{if(kind!=='documents'||!load||!allowed)return;const abort=new AbortController();let blob:Blob|undefined;setDocumentReady(false);void(async()=>{try{const file=await api.get<{url:string;name:string}>('/posts/'+post.Id+'/download',abort.signal),response=await fetch(api.asset(file.url),{signal:abort.signal});const size=Number(response.headers.get('content-length'));if(!response.ok||!size||size>10*1024*1024){await response.body?.cancel();return}blob=await response.blob();if(!abort.signal.aborted){documentBlob.current={url:api.asset(file.url),blob};setDocumentReady(true)}}catch{/* Explicit download remains available. */}})();return()=>{abort.abort();blob=undefined;documentBlob.current=null;setDocumentReady(false)}},[kind,load,allowed,post.Id]);
 if(!post.MediaUrl)return null;
 async function download(){setBusy(true);setMessage('');try{
  const file=await api.get<{url:string;name:string}>('/posts/'+post.Id+'/download');
  let blob=documentBlob.current?.url===api.asset(file.url)?documentBlob.current.blob:undefined;if(!blob){const response=await fetch(api.asset(file.url));if(!response.ok)throw Error('Media could not be downloaded.');blob=await response.blob();}
  const name=file.name.replace(/[^a-zA-Z0-9._-]/g,'_')||'community-media';
  if(Capacitor.isNativePlatform()){
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not prepare media'));reader.readAsDataURL(blob)});
   const {Filesystem,Directory}=await import('@capacitor/filesystem'),{Share}=await import('@capacitor/share');const saved=await Filesystem.writeFile({directory:Directory.Cache,path:'cda-media-'+name,data});await Share.share({files:[saved.uri],title:'Save community media'});
  }else{const local=URL.createObjectURL(blob),a=document.createElement('a');a.href=local;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(local),60000)}
  setMessage('Download prepared.');
 }catch(e){setMessage(e instanceof Error?e.message:'Download failed')}finally{setBusy(false)}}
 return <div className="post-media" ref={ref}>{!load&&kind!=='documents'?<button className="secondary" onClick={()=>setManual(true)}>Load {kind==='photos'?'photo':kind==='videos'?'video':'audio'}</button>:kind==='photos'?<img src={url} loading="lazy" alt={str(post.Caption)||'Community photo'}/>:kind==='videos'?<video src={url} controls controlsList={allowed?'':'nodownload'} preload="metadata"/>:kind==='audio'?<audio src={url} controls controlsList={allowed?'':'nodownload'} preload="metadata"/>:<p>{str(post.DocumentName)||'Attached file'}{documentReady?' · Loaded':''}</p>}{allowed&&<button className="secondary" disabled={busy} onClick={download}>{busy?'Preparing…':'Download media'}</button>}<p role="status">{message}</p></div>;
}
