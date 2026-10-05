import {useEffect,useRef,useState} from 'react';
import {Pause,Play} from 'lucide-react';
import {api} from './api';

export function ChatAttachment({id,url,type}:{id:string;url:string;type:string}){
 const[src,setSrc]=useState(url.startsWith('chat-attachment:')?'':api.asset(url)),[error,setError]=useState(''),[busy,setBusy]=useState(false),[name,setName]=useState('Attachment');
 async function load(){setBusy(true);setError('');try{const r=await api.send<{path:string;name:string}>('/conversations/'+id+'/attachments/'+url.slice(16));setSrc(api.url(r.path));setName(r.name)}catch(e){setError(e instanceof Error?e.message:'Attachment unavailable')}finally{setBusy(false)}}
 useEffect(()=>{if(url.startsWith('chat-attachment:')&&['PHOTO','IMAGE','VOICE','AUDIO','VIDEO'].includes(type))void load()},[id,url,type]);
 return <div className="chat-attachment">{!src?<button disabled={busy} onClick={()=>void load()}>{busy?'Loading…':'Open '+(type==='VOICE'?'voice message':'attachment')}</button>:['PHOTO','IMAGE'].includes(type)?<img src={src} alt={name} onError={()=>{setSrc('');setError('Image unavailable. Tap to retry.')}}/>:['AUDIO','VOICE'].includes(type)?<VoiceNote src={src} onError={()=>{setSrc('');setError('Attachment link expired or unavailable. Tap to retry.')}}/>:type==='VIDEO'?<video src={src} controls playsInline preload="metadata"/>:<a href={src} target="_blank" rel="noreferrer">Download {name}</a>}{error&&<p role="alert">{error}</p>}</div>
}

function clock(value:number){if(!Number.isFinite(value))return '0:00';const seconds=Math.max(0,Math.floor(value));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
function VoiceNote({src,onError}:{src:string;onError:()=>void}){
 const audio=useRef<HTMLAudioElement>(null),[playing,setPlaying]=useState(false),[current,setCurrent]=useState(0),[duration,setDuration]=useState(0);
 const toggle=()=>{const element=audio.current;if(!element)return;if(element.paused)void element.play();else element.pause()};
 return <div className="chat-voice-note"><button type="button" aria-label={playing?'Pause voice message':'Play voice message'} onClick={toggle}>{playing?<Pause/>:<Play/>}</button><div className="chat-voice-track" aria-hidden="true">{Array.from({length:28},(_,index)=><i key={index} className={duration&&index/28<=current/duration?'played':''} style={{height:8+(index*13%22)}}/>)}</div><span>{clock(playing?current:duration)}</span><audio ref={audio} src={src} preload="metadata" onLoadedMetadata={event=>setDuration(event.currentTarget.duration)} onTimeUpdate={event=>setCurrent(event.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={onError}/></div>
}
