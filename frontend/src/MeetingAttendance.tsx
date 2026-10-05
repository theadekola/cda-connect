import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Download,ArrowLeft} from 'lucide-react';
import {api,rows,str,type RecordData} from './api';
import {ErrorBox,Loading} from './ui';
import {exportAttendance} from './TakeAttendance';
import {getLocale} from './i18n';

export function MeetingAttendance({id,communityId}:{id:string;communityId:string}){
 const q=useQuery({queryKey:['/meetings/'+id+'/attendance'],queryFn:()=>api.get<RecordData>('/meetings/'+id+'/attendance'),refetchInterval:30000});
 const[search,setSearch]=useState(''),[status,setStatus]=useState('all'),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>();
 const meeting=(q.data?.meeting as RecordData)||{},people=rows(q.data?.participants),visible=people.filter(p=>(status==='all'||(p.Status||'ABSENT')===status)&&[p.FirstName,p.LastName,p.CardNumber].map(str).join(' ').toLowerCase().includes(search.toLowerCase()));
 return <div className="attendance-page meeting-attendance-detail"><Link className="button" to={'/community/'+communityId+'/meetings?view=attendance-history'}><ArrowLeft size={17}/>Attendance history</Link><ErrorBox error={q.error||error}/>{q.isPending?<Loading/>:q.data&&<section className="attendance-panel"><div className="attendance-toolbar"><div><h2>{str(meeting.Title)}</h2><p>{new Date(str(meeting.StartDateTime)).toLocaleString(getLocale())}</p></div><button disabled={busy||!people.length} onClick={async()=>{setBusy(true);setError(undefined);try{await exportAttendance(meeting,people)}catch(e){setError(e)}finally{setBusy(false)}}}><Download size={17}/>{busy?'Exporting…':'Export'}</button></div><div className="attendance-filter-grid"><label>Search members<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or member ID"/></label><label>Attendance status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All members</option><option value="PRESENT">Present</option><option value="LATE">Late</option><option value="ABSENT">Absent</option></select></label></div><h3>Meeting attendance ({visible.length})</h3>{visible.map(p=><div className="attendance-person" key={str(p.UserId)}><div><strong>{str(p.FirstName)} {str(p.LastName)}</strong><small>{str(p.CardNumber)}</small>{!!p.CheckedInAt&&<small>{new Date(str(p.CheckedInAt)).toLocaleString(getLocale())}</small>}</div><span className={'attendance-personal-status status-'+str(p.Status||'ABSENT').toLowerCase()}>{p.Status==='PRESENT'?'Present':p.Status==='LATE'?'Late':'Absent'}</span></div>)}{!visible.length&&<p>No members match this view.</p>}</section>}</div>
}
