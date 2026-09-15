import {HeaderSearch} from './HeaderSearch';
import {currentPosition} from './location';
import {getLocale} from './i18n';
import {useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {MapPin,UserRound,Users,Mail,Phone,MessageCircle,AtSign,Tag,Download,ShieldCheck,UserX,EyeOff,LockKeyhole,Monitor,ChevronRight,ArrowLeft} from 'lucide-react';
import {api,session,str,rows,type RecordData} from './api';
import {Loading,ErrorBox,Records,Action,MutationForm,Field} from './ui';
import {Security} from './security';

const titles:Record<string,string>={visibility:'Profile visibility',followers:'Who can follow you',comments:'Who can comment on your posts',mentions:'Who can mention you',tags:'Tag approval',blocked:'Block users',reports:'Report & manage',hidden:'Hidden users',words:'Restricted words','two-factor':'Two-factor authentication',activity:'Login activity',devices:'Trusted devices',guidelines:'Community guidelines'};
function Row({field,title,description,value,Icon}:{field:string;title:string;description:string;value?:string;Icon:typeof UserRound}){return <Link className="settings-row" to={'/settings/privacy/'+field}><span className="settings-row-icon"><Icon size={21}/></span><span className="settings-row-text"><strong>{title}</strong><small>{description}</small></span>{value&&<span className="privacy-value">{value}</span>}<ChevronRight size={17}/></Link>}
const audienceLabel=(value:unknown)=>value==='NOBODY'?'Nobody':value==='COMMUNITIES'?'My communities':'Everyone';
export function PrivacySettings(){
 const field=useLocation().pathname.split('/')[3]||'',qc=useQueryClient(),[busy,setBusy]=useState(''),[error,setError]=useState<unknown>(),[notice,setNotice]=useState('');
 const q=useQuery({queryKey:['/users/privacy'],queryFn:({signal})=>api.get<RecordData>('/users/privacy',signal)});
 async function save(key:string,value:boolean|string){setBusy(key);setError(undefined);setNotice('');try{if(key==='shareLocation'&&value===true)await currentPosition();await api.send('/users/privacy',{key,value},'PATCH');await qc.invalidateQueries();setNotice('Privacy preference saved.')}catch(e){setError(e)}finally{setBusy('')}}
 if(q.isPending)return <Loading/>;if(q.error)return <ErrorBox error={q.error}/>;const p=q.data;
 const toggle=(key:string,title:string,description:string,checked:boolean,Icon:typeof UserRound)=><label className="settings-row account-switch-row"><span className="settings-row-icon"><Icon size={21}/></span><span className="settings-row-text"><strong>{title}</strong><small>{description}</small></span><input type="checkbox" role="switch" checked={checked} disabled={!!busy} onChange={e=>save(key,e.target.checked)}/></label>;
 if(field)return <><Link className="settings-back" to="/settings/privacy"><ArrowLeft size={17}/>Privacy & safety</Link><h2 className="privacy-detail-title">{titles[field]||'Privacy & safety'}</h2><PrivacyDetail key={field} field={field} preferences={p}/></>;
 return <div className="privacy-dashboard"><p>Manage your privacy settings and stay safe on CDA Connect.</p>{error!=null&&<ErrorBox error={error}/>}<p className="privacy-status" role="status" aria-live="polite">{busy?'Saving…':notice}</p>
 <section className="settings-group"><h2>Profile privacy</h2><div className="settings-list">
 <Row field="visibility" title="Profile visibility" description="Control who can see your member profile" value={p.PrivateAccount?'My communities':'Everyone'} Icon={UserRound}/>
 <Row field="followers" title="Who can follow you" description="Choose who can follow your activities" value={p.AllowFollowers?'Eligible members':'Nobody'} Icon={Users}/>
 {toggle('showEmail','Show email','Show your email to community members',p.EmailVisibility==='MEMBERS',Mail)}
 {toggle('shareLocation','Share location','Use your device location to find nearby communities. Your position is not shown to other members.',!!p.ShareLocation,MapPin)}
 {toggle('showPhone','Show phone number','Show your number to community members',p.PhoneVisibility==='MEMBERS',Phone)}
 </div><p className="privacy-note">Community administrators retain access to contact details for community administration.</p></section>
 <section className="settings-group"><h2>Activity & content</h2><div className="settings-list">
 <Row field="comments" title="Who can comment on your posts" description="Choose who can comment on your posts" value={audienceLabel(p.CommentAudience)} Icon={MessageCircle}/>
 <Row field="mentions" title="Who can mention you" description="Choose who can mention you in posts and comments" value={audienceLabel(p.MentionAudience)} Icon={AtSign}/>
 {toggle('tagApproval','Tag approval','Review new tags before they appear on your profile',!!p.TagApproval,Tag)}
 <Row field="tags" title="Review tags" description="Approve or remove tagged posts on your profile" Icon={Tag}/>
 {toggle('allowDownloads','Allow others to download your content','Enable the app’s download action on your media posts',!!p.AllowDownloads,Download)}
 </div><p className="privacy-note">Download controls cannot prevent screenshots or copies of media someone can already view.</p></section>
 <section className="settings-group"><h2>Safety & protection</h2><div className="settings-list">
 <Row field="blocked" title="Block users" description="Prevent direct contact and access to your member profile" Icon={ShieldCheck}/>
 <Row field="reports" title="Report & manage" description="Send safety reports and check their status" Icon={UserX}/>
 <Row field="hidden" title="Hidden users" description="Keep your profile and feed posts hidden from selected members" Icon={EyeOff}/>
 <Row field="words" title="Restricted words" description="Filter words and phrases from community posts and comments" Icon={EyeOff}/>
 </div></section>
 <section className="settings-group"><h2>Security</h2><div className="settings-list">
 <Row field="two-factor" title="Two-factor authentication" description="Add extra security to your account" value={p.TwoFactorEnabled?'On':'Off'} Icon={LockKeyhole}/>
 <Row field="activity" title="Login activity" description="Review your current signed-in sessions" Icon={Monitor}/>
 <Row field="devices" title="Trusted devices" description="Recognise your devices and revoke their sessions" Icon={ShieldCheck}/>
 </div></section>
 <aside className="privacy-safety"><ShieldCheck size={35}/><div><strong>Your safety matters</strong><p>If you see something that violates your community’s rules, please report it.</p></div><Link className="button secondary" to="/settings/privacy/guidelines">Community guidelines</Link></aside>
 </div>;
}
function PrivacyDetail({field,preferences:p}:{field:string;preferences:RecordData}){
 const nav=useNavigate();
 if(['visibility','followers','comments','mentions'].includes(field)){
  const account=field==='visibility'||field==='followers',key=field==='visibility'?'privateAccount':field==='followers'?'allowFollowers':field==='comments'?'commentAudience':'mentionAudience';
  const current=field==='visibility'?(p.PrivateAccount?'COMMUNITIES':'EVERYONE'):field==='followers'?(p.AllowFollowers?'EVERYONE':'NOBODY'):str(p[field==='comments'?'CommentAudience':'MentionAudience']);
  const options=field==='visibility'?[['EVERYONE','Everyone signed in'],['COMMUNITIES','Members of communities I have joined']]:field==='followers'?[['EVERYONE','Everyone who can view my profile'],['NOBODY','Nobody']]:[['EVERYONE','Everyone who can access the post'],['COMMUNITIES','Members of my communities'],['NOBODY','Nobody except me']];
  return <section className="card"><p>{field==='visibility'?'Private profiles are visible to all active members of communities you have joined. Individual approval is not required.':field==='followers'?'Your profile visibility and blocking rules still apply.':'Community membership and blocking rules still apply. These settings never make a private community’s posts public.'}</p><MutationForm label="Save preference" onSubmit={d=>api.send(account?'/users/account/preferences':'/users/privacy',{key,value:account?(field==='visibility'?d.audience==='COMMUNITIES':d.audience==='EVERYONE'):d.audience},'PATCH')}><label>Who is allowed?<select name="audience" defaultValue={current}>{options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></MutationForm></section>;
 }
 if(field==='two-factor')return <Security/>;
 if(field==='activity')return <Security section="sessions"/>;
 if(field==='devices')return <TrustedDevices/>;
 if(field==='blocked'||field==='hidden')return <PeopleList kind={field}/>;
 if(field==='words')return <><p>Matching community posts and comments are removed from your feed and member activity views. Matching is case-insensitive. Your own content remains visible to you.</p><section className="card"><MutationForm label="Add phrase" onSubmit={d=>api.send('/users/privacy/words',{phrase:d.phrase,enabled:true},'PUT')}><Field name="phrase" label="Word or phrase"/></MutationForm></section><Records endpoint="/users/privacy/words" render={r=><div className="privacy-list-action"><strong>{str(r.Phrase)}</strong><Action run={()=>api.send('/users/privacy/words',{phrase:r.Phrase,enabled:false},'PUT')}>Remove</Action></div>}/></>;
 if(field==='tags')return <><p>New mentions in posts create profile tags. Approve a tag to show that post on your member profile. Rejecting a tag removes it from your profile; the author’s original post remains in its community.</p><Records endpoint="/users/privacy/tags" render={r=><><p className="prose">{str(r.Body)}</p><p>{str(r.Status).toLowerCase()}</p><div className="actions">{r.Status!=='APPROVED'&&<Action run={()=>api.send('/users/privacy/tags/'+r.Id,{status:'APPROVED'},'PUT')}>Approve tag</Action>}{r.Status!=='REJECTED'&&<Action run={()=>api.send('/users/privacy/tags/'+r.Id,{status:'REJECTED'},'PUT')}>Remove tag</Action>}</div></>}/></>;
 if(field==='reports')return <><section className="card"><MutationForm label="Send safety report" onSubmit={d=>api.send('/me/support-tickets',{category:'SAFETY',subject:d.subject,message:d.message})}><Field name="subject" label="What happened?"/><Field name="message" label="Details, member name or post link" type="textarea"/></MutationForm></section><Records endpoint="/users/privacy/reports" render={r=><><h3>{str(r.Title)}</h3><p>{str(r.Details)}</p><p>Status: {str(r.Status).toLowerCase()}</p><small>{new Date(str(r.CreatedAt)).toLocaleString(getLocale())}</small></>}/></>;
 if(field==='guidelines')return <><p>Open your community to read its published rules and policies. Use Report & manage to raise a concern with CDA Connect support.</p><Records endpoint="/communities" render={r=><><h3>{str(r.Name)}</h3><Link className="button secondary" to={'/community/'+r.Id+'/documents'}>Community documents & rules</Link></>}/><Link className="button" to="/settings/privacy/reports">Report a concern</Link></>;
 return <button onClick={()=>nav('/settings/privacy')}>Back to privacy settings</button>;
}
function PeopleList({kind}:{kind:'blocked'|'hidden'}){
 const[term,setTerm]=useState('');const q=useQuery({queryKey:['privacy-people',term],queryFn:()=>api.get<RecordData[]>('/users/privacy/people?q='+encodeURIComponent(term)),enabled:term.length>=2});
 return <><p>{kind==='blocked'?'Blocked members cannot open your member profile, view your feed posts or start or send direct messages to you. Shared community records and group conversations remain available to their members.':'Selected members cannot view your member profile or your community feed posts. This does not remove them from a shared community.'}</p><section className="card"><HeaderSearch label="Search"><MutationForm label="Find member" onSubmit={async d=>{if(d.search.trim().length<2)throw Error('Enter at least two characters.');setTerm(d.search.trim())}}><Field name="search" label="Search your communities by name or username"/></MutationForm></HeaderSearch>{term.length>=2&&(q.isPending?<Loading/>:q.error?<ErrorBox error={q.error}/>:<>{!q.data?.length&&<p>No matching members.</p>}{q.data?.map(r=><div className="privacy-list-action" key={str(r.Id)}><span>{str(r.FirstName)} {str(r.LastName)}</span><Action run={()=>api.send('/users/privacy/'+kind+'/'+r.Id,{enabled:true},'PUT')}>{kind==='blocked'?'Block':'Hide from'}</Action></div>)}</>)}</section><h3>{kind==='blocked'?'Blocked members':'Hidden users'}</h3><Records endpoint={'/users/privacy/'+kind} render={r=><div className="privacy-list-action"><span>{str(r.FirstName)} {str(r.LastName)}</span><Action run={()=>api.send('/users/privacy/'+kind+'/'+r.Id,{enabled:false},'PUT')}>{kind==='blocked'?'Unblock':'Remove'}</Action></div>}/></>;
}
export function TrustedDevices(){
 const nav=useNavigate(),qc=useQueryClient(),q=useQuery({queryKey:['/auth/security'],queryFn:()=>api.get<RecordData>('/auth/security',undefined,{'x-refresh-token':session.get()?.refreshToken||''})});
 return <><p>Name this signed-in device so you can recognise it. Removing a trusted device revokes its session. Trust never skips your password or two-factor authentication.</p><section className="card"><MutationForm label="Trust this device" onSubmit={d=>api.send('/auth/sessions/trust-current',{name:d.name,refreshToken:session.get()?.refreshToken},'PUT')}><Field name="name" label="Device name"/></MutationForm></section>{q.isPending?<Loading/>:q.error?<ErrorBox error={q.error}/>:<>{!rows(q.data.activeSessions).some(r=>r.TrustedName)&&<p>No trusted devices yet.</p>}{rows(q.data.activeSessions).filter(r=>r.TrustedName).map(r=><section className="card" key={str(r.Id)}><h3>{str(r.TrustedName)}{r.IsCurrent?' (this device)':''}</h3><p>Signed in {new Date(str(r.CreatedAt)).toLocaleString(getLocale())}</p><Action danger run={async()=>{await api.send('/auth/sessions/'+r.Id+'/trust',{},'DELETE');if(r.IsCurrent){session.set(null);qc.clear();nav('/login',{replace:true})}}}>Remove and sign out</Action></section>)}</>}</>;
}
