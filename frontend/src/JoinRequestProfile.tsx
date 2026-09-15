import './discovery.css';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {api,str,type RecordData} from './api';
import {Loading,ErrorBox,Action} from './ui';
export function JoinRequestProfile({communityId,requestId}:{communityId:string;requestId:string}){
 const endpoint='/communities/'+communityId+'/join-requests/'+requestId,q=useQuery({queryKey:[endpoint],queryFn:()=>api.get<RecordData>(endpoint),refetchInterval:30000});
 const back=<Link className="button secondary" to={'/community/'+communityId+'/members?tab=pending'}>Back to join requests</Link>;
 if(q.isPending)return <>{back}<Loading/></>;if(q.error)return <>{back}<ErrorBox error={q.error}/></>;const p=q.data,name=[p.FirstName,p.LastName].filter(Boolean).join(' ');
 return <section className="request-profile">{back}<article className="card"><header>{p.ProfileImage?<img src={api.asset(str(p.ProfileImage))} alt={name}/>:<span className="request-profile-initial">{name.slice(0,1)}</span>}<h1>{name}</h1>{!!p.Username&&<p>@{str(p.Username)}</p>}</header><h2>Profile details</h2><dl>{[['Name',name],['Email',p.Email],['Phone',p.Phone],['Account created',p.CreatedAt?new Date(str(p.CreatedAt)).toLocaleDateString():''],['Requested to join',new Date(str(p.RequestedAt)).toLocaleString()],['Request status',p.Status==='PENDING'?'Pending':p.Status==='APPROVED'?'Approved':'Declined']].filter(([,v])=>v).map(([label,value])=><div key={str(label)}><dt>{str(label)}</dt><dd>{str(value)}</dd></div>)}</dl><h2>Request message</h2><p>{str(p.Message)||'No message provided.'}</p>{p.Status==='PENDING'?<div className="request-profile-actions"><Action run={()=>api.send(endpoint+'/review',{decision:'APPROVE'})}>Approve</Action><Action danger run={()=>api.send(endpoint+'/review',{decision:'REJECT'})}>Decline</Action></div>:<p role="status">{p.Status==='APPROVED'?'Request approved. This person is now a member.':'This request was declined.'}</p>}</article></section>
}

