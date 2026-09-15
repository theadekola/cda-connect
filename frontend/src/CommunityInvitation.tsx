import {useState} from 'react';
import {Link,useParams,useNavigate,Navigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ShieldCheck,Share2,Copy,Users} from 'lucide-react';
import {api,str,type RecordData} from './api';
import {AuthLayout,useSession} from './auth';
import {ErrorBox,Loading} from './ui';
export function inviteCode(){const code=new URLSearchParams(window.location.search).get('invite')||'';return /^[A-Z0-9]{6,20}$/i.test(code)?code.toUpperCase():''}
function cardReturn(){const current=window.location.pathname+window.location.hash;const candidate=new URLSearchParams(window.location.search).get('returnTo')||current;return /^\/community\/[a-f0-9-]{36}\/membership-card#member=[A-Za-z0-9_-]{32}$/.test(candidate)?candidate:''}
export function authDestination(){const card=cardReturn();if(card)return card;const code=inviteCode();return code?'/invite/'+code:'/home'}
export function authLink(path:string){const card=cardReturn();if(card)return path+'?returnTo='+encodeURIComponent(card);const code=inviteCode();return path+(code?'?invite='+encodeURIComponent(code):'')}
export function CommunityCreated({community}:{community:RecordData}){
 const [message,setMessage]=useState(''),[error,setError]=useState<unknown>();const code=str(community.JoinCode),url='https://cdaconnect.org/invite/'+encodeURIComponent(code);
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setMessage(label+' copied.');setError(undefined)}catch{setError(Error('Copy is unavailable. Select and copy the text below.'))}}
 async function share(){try{if(navigator.share){await navigator.share({title:str(community.Name)||'CDA Connect community',text:'Join our community on CDA Connect',url});setMessage('Share options opened.')}else await copy(url,'Invite link')}catch(e){if((e as Error).name!=='AbortError')setError(Error('Sharing is unavailable. Copy the invite link below.'))}}
 return <section className="community-created card"><div className="creation-celebration" aria-hidden="true"><ShieldCheck size={76}/>{Array.from({length:12},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div><h1>Community created!</h1><p><strong>{str(community.Name)}</strong> is ready. Invite people and start building your community.</p><div className="creation-next"><h2>What happens next?</h2><ol><li>Share your invite link or code with future members.</li><li>Review membership requests before members join.</li><li>Open your community to post updates and connect.</li></ol></div><label>Community invite link<input readOnly value={url} onFocus={e=>e.target.select()}/></label><label>Invite code<input readOnly value={code} onFocus={e=>e.target.select()}/></label><div className="creation-actions"><button type="button" className="primary" onClick={()=>void share()}><Share2 size={18}/>Share community invite link</button><button type="button" className="secondary" onClick={()=>void copy(code,'Invite code')}><Copy size={18}/>Copy invite code</button><Link className="button primary" to={'/community/'+community.Id+'/feed'}><Users size={18}/>Go to my community</Link></div><p role="status">{message}</p><ErrorBox error={error}/></section>
}
export function CommunityInvite(){
 const {code=''}=useParams(),s=useSession(),nav=useNavigate(),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState<unknown>();
 const memberships=useQuery({queryKey:['invite-memberships',s?.user.Id],queryFn:()=>api.get<RecordData[]>('/communities'),enabled:!!s});
 const valid=/^[A-Z0-9]{6,20}$/i.test(code),q=useQuery({queryKey:['invite',code],queryFn:()=>api.get<RecordData>('/communities/invite/'+encodeURIComponent(code)),enabled:valid,retry:false});
 if(!valid)return <AuthLayout title="Community invitation"><p>This invite link is invalid.</p><Link to="/communities">Find communities</Link></AuthLayout>;
 if(q.isPending)return <Loading/>;
 if(q.error)return <AuthLayout title="Community invitation"><ErrorBox error={q.error}/><Link to="/communities">Find communities</Link></AuthLayout>;
 if(s&&Array.isArray(memberships.data)&&memberships.data.some(c=>c.Id===q.data.Id))return <Navigate to={'/community/'+q.data.Id+'/feed'} replace/>;
 if(!s)return <Navigate to={'/register?invite='+encodeURIComponent(code)} replace/>;
 async function join(){setBusy(true);setError(undefined);try{const result=await api.send<RecordData>('/communities/join',{joinCode:code});if(result.status==='PENDING')setPending(true);else nav('/community/'+result.Id+'/feed',{replace:true})}catch(e){setError(e)}finally{setBusy(false)}}
 return <AuthLayout title={str(q.data.Name)}><p>{str(q.data.Description)}</p>{pending?<><p role="status">Your request to join {str(q.data.Name)} has been sent. A community administrator needs to approve it.</p><Link to="/communities">Go to my communities</Link></>:<><p>All new members need approval from an admin, moderator or exco.</p><button className="primary" disabled={busy} onClick={()=>void join()}>{busy?'Sending request…':'Request to join'}</button></>}<ErrorBox error={error}/></AuthLayout>
}
