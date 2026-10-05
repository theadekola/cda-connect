import './discovery.css';
import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {CalendarDays,Clock3,Mail,Phone,UserRound,MessageSquareText} from 'lucide-react';
import {api,str,type RecordData} from './api';
import {Loading,ErrorBox,Action} from './ui';
export function JoinRequestProfile({communityId,requestId}:{communityId:string;requestId:string}){
 const navigate=useNavigate(),endpoint='/communities/'+communityId+'/join-requests/'+requestId,q=useQuery({queryKey:[endpoint],queryFn:()=>api.get<RecordData>(endpoint),refetchInterval:30000});
 useEffect(()=>{const link=document.querySelector<HTMLAnchorElement>('.community-header-menu');if(!link)return;const href=link.getAttribute('href')||'',label=link.getAttribute('aria-label')||'',back=(event:MouseEvent)=>{event.preventDefault();event.stopImmediatePropagation();navigate('/community/'+communityId+'/members?tab=pending')};link.classList.add('join-request-header-back');link.setAttribute('href','/community/'+communityId+'/members?tab=pending');link.setAttribute('aria-label','Back to join requests');link.addEventListener('click',back,true);return()=>{link.classList.remove('join-request-header-back');link.setAttribute('href',href);link.setAttribute('aria-label',label);link.removeEventListener('click',back,true)}},[communityId,navigate]);
 if(q.isPending)return <Loading/>;if(q.error)return <ErrorBox error={q.error}/>;const p=q.data,name=[p.FirstName,p.LastName].filter(Boolean).join(' '),status=p.Status==='PENDING'?'Pending approval':p.Status==='APPROVED'?'Approved':'Declined';
 const facts=[
  {label:'Account created',value:p.CreatedAt?new Date(str(p.CreatedAt)).toLocaleDateString():'',icon:<CalendarDays size={18}/>},
  {label:'Requested to join',value:p.RequestedAt?new Date(str(p.RequestedAt)).toLocaleString():'',icon:<Clock3 size={18}/>},
  {label:'Email address',value:p.Email,icon:<Mail size={18}/>},
  {label:'Phone number',value:p.Phone,icon:<Phone size={18}/>}
 ].filter(item=>item.value);
 return <section className="request-profile"><article className="request-profile-card"><header className="request-profile-hero"><div className="request-profile-photo">{p.ProfileImage?<img src={api.asset(str(p.ProfileImage))} alt={`${name}'s profile`}/>:<span className="request-profile-initial">{name.slice(0,1)}</span>}</div><div><span className={'request-profile-status '+str(p.Status).toLowerCase()}>{status}</span><h1>{name}</h1>{!!p.Username&&<p>@{str(p.Username)}</p>}</div></header><section className="request-profile-section" aria-labelledby="profile-details-heading"><h2 id="profile-details-heading"><UserRound size={19}/>Member information</h2><dl>{facts.map(item=><div key={item.label}><span aria-hidden="true">{item.icon}</span><dt>{item.label}</dt><dd>{str(item.value)}</dd></div>)}</dl></section><section className="request-profile-section request-profile-message" aria-labelledby="request-message-heading"><h2 id="request-message-heading"><MessageSquareText size={19}/>Request message</h2><p>{str(p.Message)||'No message was provided with this request.'}</p></section>{p.Status==='PENDING'?<div className="request-profile-actions"><Action run={()=>api.send(endpoint+'/review',{decision:'APPROVE'})}>Approve member</Action><Action danger run={()=>api.send(endpoint+'/review',{decision:'REJECT'})}>Decline request</Action></div>:<p className="request-profile-result" role="status">{p.Status==='APPROVED'?'Request approved. This person is now a member.':'This request was declined.'}</p>}</article></section>
}

