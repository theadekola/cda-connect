import {useEffect,useRef,useState} from 'react';
import {Phone,Video,PhoneOff,Mic,MicOff} from 'lucide-react';
import type {Socket} from 'socket.io-client';

export function ChatCall({socket,id}:{socket:Socket|null;id:string}){
 const[active,setActive]=useState(false),[incoming,setIncoming]=useState(false),[status,setStatus]=useState(''),[muted,setMuted]=useState(false),[streams,setStreams]=useState<Record<string,MediaStream>>({}),[local,setLocal]=useState<MediaStream>();
 const stream=useRef<MediaStream|undefined>(undefined),peers=useRef(new Map<string,RTCPeerConnection>()),joining=useRef(false),generation=useRef(0),inCall=useRef(false);
 function end(){generation.current++;joining.current=false;inCall.current=false;socket?.emit('call:leave',{conversationId:id});for(const pc of peers.current.values())pc.close();peers.current.clear();stream.current?.getTracks().forEach(t=>t.stop());stream.current=undefined;setLocal(undefined);setStreams({});setActive(false);setIncoming(false);setMuted(false)}
 async function peer(key:string,offer=false){
  let pc=peers.current.get(key);if(pc)return pc;
  let iceServers:RTCIceServer[]=[{urls:'stun:stun.l.google.com:19302'}];
  if(import.meta.env.VITE_RTC_ICE_SERVERS){try{iceServers=JSON.parse(import.meta.env.VITE_RTC_ICE_SERVERS)}catch{setStatus('Call server configuration is invalid.')}}
  pc=new RTCPeerConnection({iceServers});peers.current.set(key,pc);
  stream.current?.getTracks().forEach(track=>pc!.addTrack(track,stream.current!));
  pc.onicecandidate=e=>{if(e.candidate)socket?.emit('call:signal',{conversationId:id,targetSocketId:key,signal:{candidate:e.candidate.toJSON()}})};
  pc.ontrack=e=>{setStreams(prev=>({...prev,[key]:e.streams[0]||new MediaStream([e.track])}));setStatus('Connected')};
  pc.onconnectionstatechange=()=>{if(pc!.connectionState==='failed')setStatus('Call could not connect. Check your network or try again.');if(pc!.connectionState==='connected')setStatus('Connected')};
  if(offer){await pc.setLocalDescription(await pc.createOffer());socket?.emit('call:signal',{conversationId:id,targetSocketId:key,signal:{description:pc.localDescription}})}return pc;
 }
 async function start(video=false){
  if(joining.current||inCall.current)return;joining.current=true;const attempt=++generation.current;setStatus('Connecting call…');
  try{
   if(!socket?.connected)throw Error('Reconnect to chat before calling.');
   const media=await navigator.mediaDevices.getUserMedia({audio:true,video});if(attempt!==generation.current){media.getTracks().forEach(t=>t.stop());return}
   stream.current=media;setLocal(media);setActive(true);setIncoming(false);
   const result=await new Promise<{ok:boolean;peers:string[];error?:string}>((resolve,reject)=>socket.timeout(12000).emit('call:join',{conversationId:id},(err:Error|null,r:{ok:boolean;peers:string[];error?:string})=>err?reject(Error('Call connection timed out.')):resolve(r)));
   if(attempt!==generation.current)return;if(!result?.ok)throw Error(result?.error||'Unable to join call');inCall.current=true;setStatus(result.peers.length?'Connecting…':'Waiting for others to join…');
   for(const key of result.peers)await peer(key,true);
  }catch(e){if(attempt===generation.current){end();setStatus(e instanceof Error?e.message:'Allow microphone access to call.')}}finally{if(attempt===generation.current)joining.current=false}
 }
 useEffect(()=>{
  if(!socket)return;const candidates=new Map<string,RTCIceCandidateInit[]>();
  const signal=async(r:{conversationId:string;fromSocketId:string;signal:{description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit}})=>{
   if(r.conversationId!==id||!stream.current)return;
   try{const pc=await peer(r.fromSocketId);if(r.signal.description){await pc.setRemoteDescription(r.signal.description);for(const candidate of candidates.get(r.fromSocketId)||[])await pc.addIceCandidate(candidate);candidates.delete(r.fromSocketId);if(r.signal.description.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());socket.emit('call:signal',{conversationId:id,targetSocketId:r.fromSocketId,signal:{description:pc.localDescription}})}}else if(r.signal.candidate){if(pc.remoteDescription)await pc.addIceCandidate(r.signal.candidate);else candidates.set(r.fromSocketId,[...(candidates.get(r.fromSocketId)||[]),r.signal.candidate])}}catch{setStatus('Call connection failed. Hang up and try again.')}
  };
  const invite=(r:{conversationId:string})=>{if(r.conversationId===id&&!stream.current)setIncoming(true)};
  const left=(r:{conversationId:string;socketId:string})=>{if(r.conversationId!==id)return;peers.current.get(r.socketId)?.close();peers.current.delete(r.socketId);setStreams(prev=>{const next={...prev};delete next[r.socketId];return next});if(!peers.current.size&&stream.current)setStatus('Waiting for others to join…')};
  const disconnected=()=>{end();setStatus('Call ended because the connection was lost.')};
  socket.on('call:incoming',invite);socket.on('call:signal',signal);socket.on('call:participant-left',left);socket.on('disconnect',disconnected);
  return()=>{socket.off('call:incoming',invite);socket.off('call:signal',signal);socket.off('call:participant-left',left);socket.off('disconnect',disconnected);end()};
 },[socket,id]);
 return <><button type="button" aria-label="Voice call" disabled={!socket?.connected||active} onClick={()=>void start()}><Phone size={20}/></button><button type="button" aria-label="Video call" disabled={!socket?.connected||active} onClick={()=>void start(true)}><Video size={20}/></button>{(incoming||active||status)&&<section className="chat-call-panel" aria-label="Call"><p role="status">{incoming?'Incoming call':status}</p>{incoming?<><button onClick={()=>void start()}>Answer</button><button onClick={()=>{setIncoming(false);setStatus('')}}>Dismiss</button></>:active?<><div className="chat-call-streams">{local&&<CallVideo stream={local} muted/>}{Object.entries(streams).map(([key,value])=><CallVideo key={key} stream={value}/>)}</div><button aria-label={muted?'Unmute microphone':'Mute microphone'} onClick={()=>{stream.current?.getAudioTracks().forEach(t=>t.enabled=muted);setMuted(!muted)}}>{muted?<MicOff/>:<Mic/>}</button><button aria-label="End call" onClick={()=>{end();setStatus('')}}><PhoneOff/></button></>:<button onClick={()=>setStatus('')}>Close</button>}</section>}</>;
}
function CallVideo({stream,muted=false}:{stream:MediaStream;muted?:boolean}){const ref=useRef<HTMLVideoElement>(null);useEffect(()=>{if(ref.current){ref.current.srcObject=stream;void ref.current.play().catch(()=>{})}},[stream]);return <video ref={ref} autoPlay playsInline muted={muted} controls={!muted} className={stream.getVideoTracks().length?'':'audio-call-stream'}/>}
