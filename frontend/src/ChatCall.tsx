import {useEffect,useRef,useState} from 'react';
import {Phone,Video,PhoneOff,Mic,MicOff,Volume2,Bluetooth,Smartphone,Check} from 'lucide-react';
import {Capacitor} from '@capacitor/core';
import type {Socket} from 'socket.io-client';
import {api} from './api';
import {NativeDevice,type NativeAudioRoute,type NativeAudioRoutes} from './nativeDevice';
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
const defaultRouteLabels:Record<NativeAudioRoute,string>={earpiece:'Phone',speaker:'Speaker',bluetooth:'Bluetooth'};
type SelectableMediaDevices=MediaDevices&{selectAudioOutput?:()=>Promise<MediaDeviceInfo>};
type SinkElement=HTMLMediaElement&{setSinkId?:(id:string)=>Promise<void>};

export function ChatCall({socket,id,name,avatar,autoStart,callRequest}:{socket:Socket|null;id:string;name:string;avatar?:string;autoStart?:CallMode;callRequest?:{mode:CallMode;key:number}}){
 const[active,setActive]=useState(false),[incoming,setIncoming]=useState<CallInvite>(),[status,setStatus]=useState(''),[muted,setMuted]=useState(false),[audioRoute,setAudioRoute]=useState<NativeAudioRoute>('earpiece'),[audioRoutes,setAudioRoutes]=useState<NativeAudioRoute[]>(['earpiece','speaker']),[audioLabels,setAudioLabels]=useState(defaultRouteLabels),[routeMenu,setRouteMenu]=useState(false),[sinkId,setSinkId]=useState(''),[mode,setMode]=useState<CallMode>('audio'),[streams,setStreams]=useState<Record<string,MediaStream>>({}),[local,setLocal]=useState<MediaStream>(),[connectedAt,setConnectedAt]=useState<number>(),[elapsed,setElapsed]=useState(0);
 const stream=useRef<MediaStream|undefined>(undefined),peers=useRef(new Map<string,RTCPeerConnection>()),joining=useRef(false),generation=useRef(0),inCall=useRef(false),servers=useRef<RTCIceServer[]>([]),autoStarted=useRef(false),incomingRef=useRef<CallInvite|undefined>(undefined),connectedRef=useRef<number|undefined>(undefined),audioRouteRef=useRef<NativeAudioRoute>('earpiece'),routeMenuRef=useRef<HTMLDivElement>(null),webSinkIds=useRef<Partial<Record<NativeAudioRoute,string>>>({});
 incomingRef.current=incoming;connectedRef.current=connectedAt;
 useIncomingCallRingtone(!!incoming);
 function reapplyAudioRoute(){if(Capacitor.isNativePlatform())window.setTimeout(()=>void NativeDevice.setAudioRoute({route:audioRouteRef.current}).then(applyRoutes).catch(()=>{}),120)}
 function connected(){if(!connectedRef.current){const now=Date.now();connectedRef.current=now;setConnectedAt(now);setElapsed(0)}setStatus('Connected');reapplyAudioRoute()}
 function applyRoutes(result:NativeAudioRoutes){const next:NativeAudioRoute[]=result.available.length?result.available:['earpiece','speaker'];audioRouteRef.current=result.active;setAudioRoutes(next);setAudioRoute(result.active);setAudioLabels(previous=>({...previous,...result.labels}))}
 async function openAudioRouteMenu(){
  if(Capacitor.isNativePlatform())applyRoutes(await NativeDevice.audioRoutes().catch(()=>({available:audioRoutes,active:audioRoute,labels:audioLabels})));
  else try{const outputs=(await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='audiooutput'),bluetooth=outputs.find(device=>/bluetooth|airpod|buds|headset|earphone/i.test(device.label)),speaker=outputs.find(device=>/speaker/i.test(device.label))||outputs[0];webSinkIds.current={speaker:speaker?.deviceId,bluetooth:bluetooth?.deviceId};setAudioRoutes(['earpiece','speaker',...(bluetooth?['bluetooth' as const]:[])]);setAudioLabels({...defaultRouteLabels,...(bluetooth?{bluetooth:bluetooth.label}:{}),...(speaker?.label?{speaker:speaker.label}:{})})}catch{/* The menu still offers the browser-supported defaults. */}
  setRouteMenu(true);
 }
 async function chooseAudioRoute(route:NativeAudioRoute){
  setRouteMenu(false);
  if(Capacitor.isNativePlatform()){try{applyRoutes(await NativeDevice.setAudioRoute({route}))}catch{/* Keep the current route when a device disconnects. */}return}
  const devices=navigator.mediaDevices as SelectableMediaDevices,known=webSinkIds.current[route];
  try{if(known)setSinkId(known);else if(route!=='earpiece'&&devices.selectAudioOutput){const output=await devices.selectAudioOutput();setSinkId(output.deviceId);setAudioLabels(previous=>({...previous,[route]:output.label||previous[route]}))}audioRouteRef.current=route;setAudioRoute(route)}catch{/* Browser audio routing can be cancelled without changing call status. */}
 }
 function reset(notify=true){const wasJoining=joining.current,hadAudio=Boolean(stream.current)||inCall.current||wasJoining;generation.current++;joining.current=false;if(notify&&(inCall.current||wasJoining))socket?.emit('call:leave',{conversationId:id});inCall.current=false;for(const pc of peers.current.values())pc.close();peers.current.clear();stream.current?.getTracks().forEach(track=>track.stop());stream.current=undefined;if(hadAudio&&Capacitor.isNativePlatform())void NativeDevice.endCall().catch(()=>{});connectedRef.current=undefined;setConnectedAt(undefined);setElapsed(0);setLocal(undefined);setStreams({});setActive(false);setIncoming(undefined);setMuted(false);audioRouteRef.current='earpiece';setAudioRoute('earpiece');setAudioRoutes(['earpiece','speaker']);setAudioLabels(defaultRouteLabels);setRouteMenu(false);setSinkId('')}
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
   stream.current=media;setLocal(media);setIncoming(undefined);audioRouteRef.current=callMode==='video'?'speaker':'earpiece';if(Capacitor.isNativePlatform())try{applyRoutes(await NativeDevice.beginCall({speaker:callMode==='video'}))}catch{/* WebRTC audio still works when native route control is unavailable. */}
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
 useEffect(()=>{if(socket?.connected&&callRequest)void start(callRequest.mode)},[socket?.connected,callRequest?.key]);
 useEffect(()=>{if(!routeMenu)return;const close=(event:PointerEvent)=>{if(routeMenuRef.current&&!routeMenuRef.current.contains(event.target as Node))setRouteMenu(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[routeMenu]);
 useEffect(()=>{if(!connectedAt)return;const update=()=>setElapsed(Math.max(0,Math.floor((Date.now()-connectedAt)/1000)));update();const timer=window.setInterval(update,1000);return()=>window.clearInterval(timer)},[connectedAt]);
 const displayName=incoming?.callerName||name||'CDA Connect call',displayStatus=incoming?(incoming.mode==='video'?'Incoming video call':'Incoming voice call'):status;
 return <><button type="button" aria-label="Voice call" title="Voice call" disabled={active||!!incoming} onClick={()=>void start('audio')}><Phone size={20}/></button><button type="button" aria-label="Video call" title="Video call" disabled={active||!!incoming} onClick={()=>void start('video')}><Video size={20}/></button>{(incoming||active||status)&&<section className={'chat-call-panel '+mode} role="dialog" aria-modal="true" aria-label={mode==='video'?'Video call':'Voice call'}><header className="chat-call-heading"><h2>{displayName}</h2><p role="status">{displayStatus}</p>{connectedAt&&<small className="chat-call-duration">{clock(elapsed)}</small>}</header><div className="chat-call-stage">{active&&<div className="chat-call-streams">{mode==='video'&&local&&<CallMedia stream={local} muted sinkId={sinkId}/>} {Object.entries(streams).map(([key,value])=><CallMedia key={key} stream={value} sinkId={sinkId} onPlaying={reapplyAudioRoute}/>)}</div>}<div className="chat-call-avatar" aria-hidden="true">{avatar?<img src={avatar} alt=""/>:<span>{displayName.slice(0,1).toUpperCase()}</span>}</div></div>{routeMenu&&<div ref={routeMenuRef} className="chat-audio-route-menu" role="menu" aria-label="Choose audio output">{audioRoutes.map(route=><button type="button" role="menuitemradio" aria-checked={route===audioRoute} key={route} onClick={()=>void chooseAudioRoute(route)}>{route===audioRoute?<Check/>:<span className="route-check"/>}{route==='bluetooth'?<Bluetooth/>:route==='earpiece'?<Smartphone/>:<Volume2/>}<span>{audioLabels[route]||defaultRouteLabels[route]}</span></button>)}</div>}{incoming?<div className="chat-call-controls incoming"><button className="call-accept" onClick={()=>void start(incoming.mode||'audio')}>{incoming.mode==='video'?<Video/>:<Phone/>}<span>Answer</span></button><button className="call-end" onClick={()=>{socket?.emit('call:decline',{conversationId:id});reset(false);setStatus('')}}><PhoneOff/><span>Decline</span></button></div>:active?<div className="chat-call-controls active"><button aria-label={`Choose audio output. Current output: ${audioLabels[audioRoute]||defaultRouteLabels[audioRoute]}`} aria-expanded={routeMenu} onClick={()=>void openAudioRouteMenu()}>{audioRoute==='bluetooth'?<Bluetooth/>:<Volume2/>}<span>Audio</span><small>{audioLabels[audioRoute]||defaultRouteLabels[audioRoute]}</small></button><button aria-label={muted?'Unmute microphone':'Mute microphone'} aria-pressed={muted} onClick={()=>{stream.current?.getAudioTracks().forEach(track=>track.enabled=muted);setMuted(!muted)}}>{muted?<MicOff/>:<Mic/>}<span>Mute</span></button><button className="call-end" aria-label="End call" onClick={()=>{reset();setStatus('')}}><PhoneOff/><span>End</span></button></div>:<button className="chat-call-close" onClick={()=>setStatus('')}>Close</button>}</section>}</>;
}
function CallMedia({stream,muted=false,sinkId='',onPlaying}:{stream:MediaStream;muted?:boolean;sinkId?:string;onPlaying?:()=>void}){const ref=useRef<HTMLMediaElement>(null),video=stream.getVideoTracks().length>0;useEffect(()=>{const element=ref.current as SinkElement|null;if(!element)return;element.srcObject=stream;const route=async()=>{if(sinkId&&element.setSinkId)await element.setSinkId(sinkId);await element.play();onPlaying?.()};void route().catch(()=>{})},[stream,sinkId]);return video?<video ref={ref as React.RefObject<HTMLVideoElement>} autoPlay playsInline muted={muted}/>:<audio ref={ref as React.RefObject<HTMLAudioElement>} autoPlay muted={muted} className="audio-call-stream"/>}
