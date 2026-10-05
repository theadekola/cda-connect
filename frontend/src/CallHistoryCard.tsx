import {PhoneIncoming,PhoneOutgoing,Video} from 'lucide-react';
import {getLocale} from './i18n';
import {str,type RecordData} from './api';

type CallEvent={mode?:'audio'|'video';status?:'RINGING'|'CONNECTED'|'ENDED'|'NO_ANSWER';durationSeconds?:number};
function read(value:unknown):CallEvent{try{return JSON.parse(str(value)) as CallEvent}catch{return{}}}
function duration(seconds:number){if(seconds<60)return `${seconds} sec`;const minutes=Math.floor(seconds/60),rest=seconds%60;return rest?`${minutes} min ${rest} sec`:`${minutes} min`}

export function CallHistoryCard({message,mine}:{message:RecordData;mine:boolean}){
 const event=read(message.MessageText),video=event.mode==='video',seconds=Math.max(0,Math.round(Number(event.durationSeconds)||0)),missed=event.status==='NO_ANSWER',Icon=video?Video:mine?PhoneOutgoing:PhoneIncoming;
 const title=missed&&!mine?`Missed ${video?'video':'voice'} call`:`${video?'Video':'Voice'} call`;
 const detail=missed?(mine?'No answer':'Tap the call button to call back'):event.status==='RINGING'?'Calling…':event.status==='CONNECTED'?'Connected':seconds?duration(seconds):'Ended';
 return <article className={'call-history-card '+(mine?'mine ':'')+(missed&&!mine?'missed':'')} aria-label={`${title}, ${detail}`}><span className="call-history-icon"><Icon/></span><span className="call-history-copy"><strong>{title}</strong><span>{detail}</span></span><time>{message.CreatedAt?new Date(str(message.CreatedAt)).toLocaleTimeString(getLocale(),{hour:'2-digit',minute:'2-digit'}):''}</time></article>;
}
