import {useEffect,useRef,useState} from 'react';
import {Phone,PhoneOff,Video} from 'lucide-react';
import {io,type Socket} from 'socket.io-client';
import {useLocation,useNavigate} from 'react-router-dom';
import {socketOrigin} from './api';
import {useSession} from './auth';

type Invite={conversationId:string;callerName?:string;conversationName?:string;mode?:'audio'|'video'};

export function IncomingCallListener(){
 const currentSession=useSession(),location=useLocation(),navigate=useNavigate(),socket=useRef<Socket|undefined>(undefined),path=useRef(location.pathname),[invite,setInvite]=useState<Invite>();path.current=location.pathname;
 useEffect(()=>{if(!currentSession)return;const connected=io(socketOrigin(),{auth:{token:currentSession.accessToken}});socket.current=connected;
  const incoming=(next:Invite)=>{if(path.current===`/chat/${next.conversationId}`)return;setInvite({...next,mode:next.mode==='video'?'video':'audio'})};
  const dismiss=(result:{conversationId:string})=>setInvite(value=>value?.conversationId===result.conversationId?undefined:value);
  connected.on('call:incoming',incoming);connected.on('call:cancelled',dismiss);connected.on('call:answered',dismiss);
  return()=>{connected.off('call:incoming',incoming);connected.off('call:cancelled',dismiss);connected.off('call:answered',dismiss);connected.disconnect();socket.current=undefined};
 },[currentSession?.accessToken]);
 if(!invite)return null;const mode=invite.mode||'audio';
 return <section className="incoming-call-overlay" role="dialog" aria-modal="true" aria-label={`Incoming ${mode} call`}><div className="incoming-call-card">{mode==='video'?<Video size={34}/>:<Phone size={34}/>}<p>{mode==='video'?'Incoming video call':'Incoming voice call'}</p><strong>{invite.callerName||invite.conversationName||'CDA Connect member'}</strong>{invite.conversationName&&invite.callerName&&<small>{invite.conversationName}</small>}<div className="chat-call-controls"><button className="call-accept" onClick={()=>{const current=invite;setInvite(undefined);navigate(`/chat/${encodeURIComponent(current.conversationId)}?call=${mode}`)}}><Phone/><span>Answer</span></button><button className="call-end" onClick={()=>{socket.current?.emit('call:decline',{conversationId:invite.conversationId});setInvite(undefined)}}><PhoneOff/><span>Decline</span></button></div></div></section>;
}
