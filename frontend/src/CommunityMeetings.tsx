import {AttendanceHistory} from './AttendanceHistory';
import {TakeAttendance} from './TakeAttendance';
import {MeetingDetails} from './MeetingDetails';
import {MeetingWizard} from './MeetingWizard';
import {useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {CalendarDays,CalendarPlus,Users,QrCode,FileText,Archive,Clock,MapPin,ChevronRight,Crown,Folder,Siren,ArrowLeft} from 'lucide-react';
import {api,str,rows,session,type RecordData} from './api';
import {Field,MutationForm,ErrorBox,Loading,Action} from './ui';
import {DomainActions} from './domain';
import {exportCalendar} from './CommunityEvents';
import {getLocale} from './i18n';
const templates=[{name:'General Meeting',description:'Community-wide discussion',icon:Users,agenda:'Welcome and apologies\nPrevious actions\nCommunity updates\nQuestions and next steps'},{name:'Executive Meeting',description:'Leadership planning',icon:Crown,agenda:'Welcome\nLeadership updates\nDecisions and responsibilities\nNext steps'},{name:'Project Meeting',description:'Discuss specific projects',icon:Folder,agenda:'Project progress\nRisks and blockers\nBudget and resources\nActions and owners'},{name:'Emergency Meeting',description:'Urgent community matters',icon:Siren,agenda:'Situation update\nImmediate priorities\nResponsibilities\nFollow-up arrangements'}];
const past=(m:RecordData)=>new Date(str(m.EndDateTime)).getTime()<Date.now();
function Schedule({meeting:m}:{meeting:RecordData}){const start=new Date(str(m.StartDateTime)),end=new Date(str(m.EndDateTime));return <><p><Clock size={16}/>{start.toLocaleTimeString(getLocale(),{hour:'2-digit',minute:'2-digit'})} – {end.toLocaleTimeString(getLocale(),{hour:'2-digit',minute:'2-digit',timeZoneName:'short'})}</p><p><MapPin size={16}/>{str(m.Location)||(m.OnlineMeetingUrl?'Online meeting':'Location to be announced')}</p></>}
export function CommunityMeetings({id,permissions}:{id:string;permissions:string[]}){
 const[params,setParams]=useSearchParams(),[tab,setTab]=useState('upcoming'),[allShown,setAllShown]=useState(false),[error,setError]=useState<unknown>(),qc=useQueryClient(),base='/communities/'+id+'/meetings';
 const query=useQuery({queryKey:[base],queryFn:({signal})=>api.get<RecordData[]>(base,signal)}),canCreate=permissions.includes('MEETING_CREATE'),mode=params.get('view'),meetingId=params.get('meeting');
 const meetings=(query.data||[]).filter(m=>tab==='past'?past(m):tab==='mine'?m.CreatedBy===session.get()?.user.Id||['GOING','MAYBE'].includes(str(m.MyResponse)):!past(m)).sort((a,b)=>(Date.parse(str(a.StartDateTime))-Date.parse(str(b.StartDateTime)))*(tab==='past'?-1:1));
 function create(template=templates[0]){setParams({view:'create',template:template.name});window.scrollTo({top:0})}
 function open(m:RecordData){setParams({meeting:str(m.Id)});window.scrollTo({top:0})}
 if(mode==='attendance-history')return <AttendanceHistory id={id}/>;
 if(mode==='create')return <MeetingWizard id={id} allowed={canCreate} canUpload={permissions.includes('DOCUMENT_MANAGE')} template={templates.find(t=>t.name===params.get('template'))||templates[0]} close={()=>setParams({})} created={async m=>{await qc.invalidateQueries({queryKey:[base]});open(m)}}/>;
 if(mode==='take-attendance'||mode==='notes')return <TakeAttendance id={id} allowed={permissions.includes('ATTENDANCE_MANAGE')} close={()=>setParams({})}/>;
 if(meetingId)return <MeetingDetails key={meetingId} id={meetingId} communityId={id} close={()=>setParams({})}/>;
 return <div className="community-meetings"><nav className="meeting-shortcuts" aria-label="Meeting actions"><button disabled={!canCreate} onClick={()=>create()}><CalendarPlus/><span>Create Meeting</span></button><Link to={'/community/'+id+'/attendance'}><QrCode/><span>Attendance</span></Link>{permissions.includes('ATTENDANCE_MANAGE')&&<button onClick={()=>setParams({view:'take-attendance'})}><Users/><span>Take Attendance</span></button>}<button onClick={()=>{setParams({view:'attendance-history'});window.scrollTo({top:0})}}><Archive/><span>Attendance History</span></button></nav>
 <nav className="meeting-tabs" aria-label="Meeting views">{[['upcoming','Upcoming'],['past','Past'],['mine','My Meetings']].map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setAllShown(false)}}>{label}</button>)}</nav>
 <section><div className="meeting-section-heading"><h2>{tab==='upcoming'?'Upcoming Meetings':tab==='past'?'Past Meetings':'My Meetings'}</h2>{meetings.length>3&&!allShown&&<button onClick={()=>setAllShown(true)}>See all</button>}</div><ErrorBox error={error}/>{query.isPending?<Loading/>:query.error?<ErrorBox error={query.error}/>:meetings.length?<div className="meeting-list">{(allShown?meetings:meetings.slice(0,3)).map(m=>{const date=new Date(str(m.StartDateTime));return <article className="meeting-card" key={str(m.Id)}><time dateTime={str(m.StartDateTime)}><span>{date.toLocaleDateString(getLocale(),{weekday:'short'})}</span><strong>{date.getDate()}</strong><span>{date.toLocaleDateString(getLocale(),{month:'short'})}</span></time><div className="meeting-copy"><header><h3>{str(m.Title)}</h3><small>{past(m)?'Past':Date.parse(str(m.StartDateTime))<=Date.now()?'In progress':'Upcoming'}</small></header><Schedule meeting={m}/><p><Users size={16}/>{str(m.SettingsJson).includes('ORGANISERS')?'Restricted to organisers':'Open to community members'}</p>{['GOING','MAYBE'].includes(str(m.MyResponse))&&<p className="meeting-response">Your RSVP: {m.MyResponse==='GOING'?'Going':'Maybe'}</p>}</div><div className="meeting-card-actions">{!!m.AllowCalendar&&<button onClick={()=>void exportCalendar(m).catch(setError)}><CalendarPlus size={17}/>Add to Calendar</button>}<button className="primary" onClick={()=>open(m)}>View Details<ChevronRight size={17}/></button></div></article>})}</div>:<p className="meetings-empty">{tab==='mine'?'Meetings you create or RSVP to will appear here.':tab==='past'?'No past meetings yet.':'No upcoming meetings yet.'}</p>}</section>
 </div>
}
