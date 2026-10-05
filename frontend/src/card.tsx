import {useEffect,useRef} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {QRCodeSVG} from 'qrcode.react';
import {ShieldCheck,Mail,Phone,MapPin,CalendarDays,Users,Vote,CheckCircle,MessageSquare,X} from 'lucide-react';
import {getLocale} from './i18n';
import {api,str,type RecordData} from './api';
import {Loading,ErrorBox} from './ui';
import './membership-card.css';
export function MembershipCard({id}:{id:string}){
 const loc=useLocation(),token=new URLSearchParams(loc.hash.slice(1)).get('member')||'',verify=!!token;
 const path='/communities/'+id+'/membership-card',endpoint=verify?path+'/verify?token='+encodeURIComponent(token):path;
 const q=useQuery({queryKey:[endpoint],queryFn:()=>api.get<RecordData>(endpoint),retry:false,staleTime:0,gcTime:0});
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.close()},[token]);
 if(q.isPending)return <Loading/>;if(q.error)return <ErrorBox error={q.error}/>;
 const r=q.data,name=[r.FirstName,r.LastName].filter(Boolean).join(' '),community=str(r.CommunityName),base='/community/'+id;
 const date=(v:unknown)=>v?new Date(str(v)).toLocaleDateString(getLocale(),{day:'numeric',month:'short',year:'numeric'}):'Not recorded';
 const address=[r.LGA,r.State,r.Country].filter(Boolean).join(', '),roles=[...new Set((str(r.Roles)+','+str(r.ExcoPosition)).split(',').map(x=>x.trim()).filter(Boolean))];
 const qr='https://cdaconnect.org'+base+'/membership-card#member='+encodeURIComponent(str(r.QrToken));
 const portrait=r.ProfileImage?<img src={api.asset(str(r.ProfileImage))} alt={name}/>:<span>{str(r.FirstName).slice(0,1)}{str(r.LastName).slice(0,1)}</span>;
 return <div className="membership-page">
 <section className="identity-card" aria-label="Membership card"><header><div>{r.CommunityLogo?<img src={api.asset(str(r.CommunityLogo))} alt=""/>:<Users/>}<strong>{community}<small>CDA Connect membership</small></strong></div><span><ShieldCheck size={17}/>Active</span></header>
 <div className="identity-body"><div className="identity-portrait">{portrait}</div><div className="identity-person"><h2>{name}</h2><p className="identity-status">Active member</p><div className="identity-number">Member ID: <strong>{str(r.CardNumber)}</strong></div></div>
 <div className="identity-details"><div className="identity-contact">{!!r.Email&&<a href={'mailto:'+str(r.Email)}><Mail/>{str(r.Email)}</a>}{!!r.Phone&&<a href={'tel:'+str(r.Phone)}><Phone/>{str(r.Phone)}</a>}{address&&<span><MapPin/>{address}</span>}</div><div className="identity-dates"><span><CalendarDays/>Joined {date(r.JoinedAt)}</span><span><ShieldCheck/>{r.ExpiresAt?'Valid through '+date(r.ExpiresAt):'Valid while membership is active'}</span></div></div></div> {!verify&&<footer><button className="identity-qr" aria-label="Expand membership QR code" onClick={()=>dialog.current?.showModal()}><QRCodeSVG value={qr} size={100} bgColor="transparent" marginSize={4} level="M"/><span>Tap to expand</span></button><div><strong>TOGETHER</strong><p>We build stronger communities.</p><small>Scan to verify membership.</small></div></footer>}
 {verify&&<p className="identity-verified"><ShieldCheck size={20}/>Membership verified against the community’s current records.</p>}</section>
 {!verify&&<><section className="membership-stats" aria-label="Community activity">{[[Users,r.CommunityCount,'Communities','/communities'],[CheckCircle,r.CheckInCount,'Check-ins','attendance'],[Vote,r.VoteCount,'Votes','polls'],[MessageSquare,r.PostCount,'Posts','feed']].map(([Icon,n,label,section])=>{const I=Icon as typeof Users;return <Link key={String(label)} to={String(section).startsWith('/')?String(section):base+'/'+section}><I/><strong>{Number(n||0)}</strong><span>{String(label)}</span></Link>})}</section>
 <section className="membership-panel"><h2>My community</h2><div className="membership-community"><Users/><div><strong>{community}</strong><p>Joined {date(r.JoinedAt)}</p><small>{Number(r.CommunityMemberCount||0)} members</small></div><Link to={base+'/feed'} className="button secondary">View community</Link></div></section>
 <section className="membership-panel"><h2>Roles and permissions</h2><div className="membership-roles">{(roles.length?roles:['Member']).map(role=><div key={role}><ShieldCheck/><div><strong>{role}</strong><small>{community}</small></div></div>)}</div></section>
 <dialog className="membership-dialog" ref={dialog} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}><button className="qr-close" aria-label="Close QR code" onClick={()=>dialog.current?.close()}><X/></button><h2>{name}</h2><p>{community}</p><QRCodeSVG value={qr} size={300} marginSize={4} level="M"/><strong>{str(r.CardNumber)}</strong><p>Scan to verify membership or check in.</p><small>Community sign-in is required to view identity.</small></dialog></>}
 </div>
}
