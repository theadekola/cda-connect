import {useEffect,useRef,useState} from 'react';
import {Phone,Video,PhoneOff,Mic,MicOff,Volume2,VolumeX} from 'lucide-react';
import type {Socket} from 'socket.io-client';
import {api} from './api';
import {useIncomingCallRingtone} from './useIncomingCallRingtone';

type CallMode='audio'|'video';
type CallInvite={conversationId:string;mode?:CallMode;callerName?:string};
let icePromise:Promise<RTCIceServer[]>|undefined;

function iceServers(){
 if(!icePromise)icePromise=api.get<{iceServers:RTCIceServer[]}>('/calls/ice').then(value=>value.iceServers).catch(()=>{
  if(import.meta.env.VITE_RTC_ICE_SERVERS){try{return JSON.parse(import.meta.env.VITE_RTC_ICE_SERVERS) as RTCIceServer[]}catch{/* Use the safe fallback below. */}}
  return [{urls:'stun:stun.l.google.com:19302'}];
 });
 return icePromise;
}
function clock(seconds:number){return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}

export function ChatCall({socket,id,name,avatar,autoStart}:{socket:Socket|null;id:string;name:string;avatar?:string;autoStart?:CallMode}){
 const[active,setActive]=useState(false),[incoming,setIncoming]=useState<CallInvite>(),[status,setStatus]=useState(''),[muted,setMuted]=useState(false),[speakerOn,setSpeakerOn]=useState(true),[mode,setMode]=useState<CallMode>('audio'),[streams,setStreams]=useState<Record<string,MediaStream>>({}),[local,setLocal]=useState<MediaStream>(),[connectedAt,setConnectedAt]=useState<number>(),[elapsed,setElapsed]=useState(0);
 const stream=useRef<MediaStream|undefined>(undefined),peers=useRef(new Map<string,RTCPeerConnection>()),joining=useRef(false),generation=useRef(0),inCall=useRef(false),servers=useRef<RTCIceServer[]>([]),autoStarted=useRef(false),incomingRef=useRef<CallInvite|undefined>(undefined),connectedRef=useRef<number|undefined>(undefined);
 incomingRef.current=incoming;connectedRef.current=connectedAt;
 useIncomingCallRingtone(!!incoming);
 function connected(){if(!connectedRef.current){const now=Date.now();connectedRef.current=now;setConnectedAt(now);setElapsed(0)}setStatus('Connected')}
 function reset(notify=true){const wasJoining=joining.current;generation.current++;joining.current=false;if(notify&&(inCall.current||wasJoining))socket?.emit('call:leave',{conversationId:id});inCall.current=false;for(const pc of peers.current.values())pc.close();peers.current.clear();stream.current?.getTracks().forEach(track=>track.stop());stream.current=undefined;connectedRef.current=undefined;setConnectedAt(undefined);setElapsed(0);setLocal(undefined);setStreams({});setActive(false);setIncoming(undefined);setMuted(false);setSpeakerOn(true)}
 async function peer(key:string,offer=false){
  let pc=peers.current.get(key);if(pc)return pc;
  pc=new RTCPeerConnection({iceServers:servers.current});peers.current.set(key,pc);
  stream.current?.getTracks().forEach(track=>pc!.addTrack(track,stream.current!));
  pc.onicecandidate=event=>{if(event.candidate)socket?.emit('call:signal',{conversationId:id,targetSocketId:key,signal:{candidate:event.candidate.toJSON()}})};
  pc.ontrack=event=>{setStreams(previous=>({...previous,[key]:event.streams[0]||new MediaStream([event.track])}));connected()};
  pc.onconnectionstatechange=()=>{if(pc!.connectionState==='failed')setStatus('Call could not connect. Check your network and try again.');else if(pc!.connectionState==='connected')connected()};
  if(offer){await pc.setLocalDescription(await pc.createOffer());socket?.emit('call:signal',{conversationId:id,targetSocketId:key,signal:{description:pc.localDescription}})}return pc;
 }
 async function start(callMode:CallMode){
  if(joining.current||inCall.current)return;joining.current=true;const attempt=++generation.current;setMode(callMode);setActive(true);setStatus(callMode==='video'?'Starting video call.':'Calling.');
  try{
   if(!socket?.connected)throw Error('Reconnect to chat before calling.');servers.current=await iceServers();
   const media=await navigator.mediaDevices.getUserMedia({audio:true,video:callMode==='video'});if(attempt!==generation.current){media.getTracks().forEach(track=>track.stop());return}
   stream.current=media;setLocal(media);setIncoming(undefined);
   const result=await new Promise<{ok:boolean;peers:string[];error?:string}>((resolve,reject)=>socket.timeout(12000).emit('call:join',{conversationId:id,mode:callMode},(error:Error|null,response:{ok:boolean;peers:string[];error?:string})=>error?reject(Error('Call connection timed out.')):resolve(response)));
   if(attempt!==generation.current)return;if(!result?.ok)throw Error(result?.error||'Unable to join call');inCall.current=true;setStatus(result.peers.length?'Connecting.':'Ringing.');for(const key of result.peers)await peer(key,true);
  }catch(error){if(attempt===generation.current){reset();const denied=error instanceof DOMException&&error.name==='NotAllowedError',missing=error instanceof DOMException&&error.name==='NotFoundError';setStatus(denied?'Allow microphone and camera access in your device settings.':missing?'No microphone or camera is available on this device.':error instanceof Error?error.message:'Unable to start the call.')}}finally{if(attempt===generation.current)joining.current=false}
 }
 useEffect(()=>{
  if(!socket)return;const candidates=new Map<string,RTCIceCandidateInit[]>();
  const signal=async(result:{conversationId:string;fromSocketId:string;signal:{description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit}})=>{if(result.conversationId!==id||!stream.current)return;try{const pc=await peer(result.fromSocketId);if(result.signal.description){await pc.setRemoteDescription(result.signal.description);for(const candidate of candidates.get(result.fromSocketId)||[])await pc.addIceCandidate(candidate);candidates.delete(result.fromSocketId);if(result.signal.description.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());socket.emit('call:signal',{conversationId:id,targetSocketId:result.fromSocketId,signal:{description:pc.localDescription}})}}else if(result.signal.candidate){if(pc.remoteDescription)await pc.addIceCandidate(result.signal.candidate);else candidates.set(result.fromSocketId,[...(candidates.get(result.fromSocketId)||[]),result.signal.candidate])}}catch{setStatus('Call connection failed. Hang up and try again.')}};
  const invite=(result:CallInvite)=>{if(result.conversationId===id&&!stream.current){const nextMode=result.mode==='video'?'video':'audio';setMode(nextMode);setIncoming({...result,mode:nextMode})}};
  const joined=(result:{conversationId:string})=>{if(result.conversationId===id&&stream.current)setStatus('Connecting.')};
  const declined=(result:{conversationId:string})=>{if(result.conversationId===id&&stream.current&&!peers.current.size){reset(false);setStatus('')}};
  const cancelled=(result:{conversationId:string})=>{if(result.conversationId===id&&incomingRef.current){reset(false);setStatus('')}};
  const left=(result:{conversationId:string;socketId:string})=>{if(result.conversationId!==id)return;peers.current.get(result.socketId)?.close();peers.current.delete(result.socketId);if(stream.current){reset(false);setStatus('')}};
  const disconnected=()=>{const callWasActive=inCall.current||joining.current||!!stream.current;if(!callWasActive){setIncoming(undefined);return}reset(false);setStatus('Call ended because the connection was lost.')};
  socket.on('call:incoming',invite);socket.on('call:signal',signal);socket.on('call:participant-joined',joined);socket.on('call:participant-left',left);socket.on('call:declined',declined);socket.on('call:cancelled',cancelled);socket.on('disconnect',disconnected);
  return()=>{socket.off('call:incoming',invite);socket.off('call:signal',signal);socket.off('call:participant-joined',joined);socket.off('call:participant-left',left);socket.off('call:declined',declined);socket.off('call:cancelled',cancelled);socket.off('disconnect',disconnected);reset()};
 },[socket,id]);
 useEffect(()=>{if(socket?.connected&&autoStart&&!autoStarted.current){autoStarted.current=true;void start(autoStart)}},[socket?.connected,autoStart]);
 useEffect(()=>{if(!connectedAt)return;const update=()=>setElapsed(Math.max(0,Math.floor((Date.now()-connectedAt)/1000)));update();const timer=window.setInterval(update,1000);return()=>window.clearInterval(timer)},[connectedAt]);
 const displayName=incoming?.callerName||name||'CDA Connect call',displayStatus=incoming?(incoming.mode==='video'?'Incoming video call':'Incoming voice call'):status;
 return <><button type="button" aria-label="Voice call" title="Voice call" disabled={active||!!incoming} onClick={()=>void start('audio')}><Phone size={20}/></button><button type="button" aria-label="Video call" title="Video call" disabled={active||!!incoming} onClick={()=>void start('video')}><Video size={20}/></button>{(incoming||active||status)&&<section className={'chat-call-panel '+mode} role="dialog" aria-modal="true" aria-label={mode==='video'?'Video call':'Voice call'}><header className="chat-call-heading"><h2>{displayName}</h2><p role="status">{displayStatus}</p>{connectedAt&&<small className="chat-call-duration">{clock(elapsed)}</small>}</header><div className="chat-call-stage">{mode==='video'&&active&&<div className="chat-call-streams">{local&&<CallVideo stream={local} muted/>}{Object.entries(streams).map(([key,value])=><CallVideo key={key} stream={value} muted={!speakerOn}/>)}</div>}<div className="chat-call-avatar" aria-hidden="true">{avatar?<img src={avatar} alt=""/>:<span>{displayName.slice(0,1).toUpperCase()}</span>}</div></div>{incoming?<div className="chat-call-controls incoming"><button className="call-accept" onClick={()=>void start(incoming.mode||'audio')}>{incoming.mode==='video'?<Video/>:<Phone/>}<span>Answer</span></button><button className="call-end" onClick={()=>{socket?.emit('call:decline',{conversationId:id});reset(false);setStatus('')}}><PhoneOff/><span>Decline</span></button></div>:active?<div className="chat-call-controls active"><button aria-label={speakerOn?'Turn call audio off':'Turn call audio on'} aria-pressed={speakerOn} onClick={()=>setSpeakerOn(value=>!value)}>{speakerOn?<Volume2/>:<VolumeX/>}<span>Audio</span></button><button aria-label={muted?'Unmute microphone':'Mute microphone'} aria-pressed={muted} onClick={()=>{stream.current?.getAudioTracks().forEach(track=>track.enabled=muted);setMuted(!muted)}}>{muted?<MicOff/>:<Mic/>}<span>Mute</span></button><button className="call-end" aria-label="End call" onClick={()=>{reset();setStatus('')}}><PhoneOff/><span>End</span></button></div>:<button className="chat-call-close" onClick={()=>setStatus('')}>Close</button>}</section>}</>;
}
function CallVideo({stream,muted=false}:{stream:MediaStream;muted?:boolean}){const ref=useRef<HTMLVideoElement>(null);useEffect(()=>{if(ref.current){ref.current.srcObject=stream;void ref.current.play().catch(()=>{})}},[stream]);return <video ref={ref} autoPlay playsInline muted={muted} className={stream.getVideoTracks().length?'':'audio-call-stream'}/>}
