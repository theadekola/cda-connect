import {Capacitor} from '@capacitor/core';
import {useState} from 'react';
import {api,session,str,type RecordData} from './api';
export function PostMedia({post}:{post:RecordData}){
 const[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(!post.MediaUrl)return null;
 const url=api.asset(str(post.MediaUrl)),type=str(post.MediaType),allowed=Boolean(post.AllowDownloads)||post.CreatedBy===session.get()?.user.Id;
 async function download(){setBusy(true);setMessage('');try{
  const file=await api.get<{url:string;name:string}>('/posts/'+post.Id+'/download');
  const response=await fetch(api.asset(file.url));if(!response.ok)throw Error('Media could not be downloaded.');const blob=await response.blob();
  const name=file.name.replace(/[^a-zA-Z0-9._-]/g,'_')||'community-media';
  if(Capacitor.isNativePlatform()){
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not prepare media'));reader.readAsDataURL(blob)});
   const {Filesystem,Directory}=await import('@capacitor/filesystem'),{Share}=await import('@capacitor/share');const saved=await Filesystem.writeFile({directory:Directory.Cache,path:name,data});await Share.share({files:[saved.uri],title:'Save community media'});
  }else{const local=URL.createObjectURL(blob),a=document.createElement('a');a.href=local;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(local),60000)}
  setMessage('Download prepared.');
 }catch(e){setMessage(e instanceof Error?e.message:'Download failed')}finally{setBusy(false)}}
 return <div className="post-media">{type.startsWith('image/')?<img src={url} alt={str(post.Caption)||'Community photo'}/>:type.startsWith('video/')?<video src={url} controls controlsList={allowed?'':'nodownload'} preload="metadata"/>:type.startsWith('audio/')?<audio src={url} controls controlsList={allowed?'':'nodownload'} preload="metadata"/>:<p>{str(post.DocumentName)||'Attached file'}</p>}{allowed&&<button className="secondary" disabled={busy} onClick={download}>{busy?'Preparing…':'Download media'}</button>}<p role="status">{message}</p></div>;
}
