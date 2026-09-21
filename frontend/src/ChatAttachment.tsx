import {useEffect,useState} from 'react';
import {api} from './api';
export function ChatAttachment({id,url,type}:{id:string;url:string;type:string}){
 const[src,setSrc]=useState(url.startsWith('chat-attachment:')?'':api.asset(url)),[error,setError]=useState(''),[busy,setBusy]=useState(false),[name,setName]=useState('Attachment');
 async function load(){setBusy(true);setError('');try{const r=await api.send<{path:string;name:string}>('/conversations/'+id+'/attachments/'+url.slice(16));setSrc(api.url(r.path));setName(r.name)}catch(e){setError(e instanceof Error?e.message:'Attachment unavailable')}finally{setBusy(false)}}
 useEffect(()=>{if(url.startsWith('chat-attachment:')&&['PHOTO','IMAGE','VOICE','AUDIO','VIDEO'].includes(type))void load()},[id,url,type]);
 return <div className="chat-attachment">{!src?<button disabled={busy} onClick={()=>void load()}>{busy?'Loading…':'Open '+(type==='VOICE'?'voice message':'attachment')}</button>:['PHOTO','IMAGE'].includes(type)?<img src={src} alt={name} onError={()=>{setSrc('');setError('Image unavailable. Tap to retry.')}}/>:['AUDIO','VOICE'].includes(type)?<audio src={src} controls controlsList="nodownload" preload="metadata" onError={()=>{setSrc('');setError('Attachment link expired or unavailable. Tap to retry.')}}/>:type==='VIDEO'?<video src={src} controls playsInline preload="metadata"/>:<a href={src} target="_blank" rel="noreferrer">Download {name}</a>}{error&&<p role="alert">{error}</p>}</div>
}
