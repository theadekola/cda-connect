import {CommunicationsSettings} from './communications';
import {PrivacySettings} from './privacy';
import {AccountSettings} from './account';
import packageInfo from '../package.json';
import {useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {UserRound,ShieldCheck,Bell,Palette,Globe,MessageCircle,Users,Cloud,LockKeyhole,HelpCircle,Info,KeyRound,Monitor,Trash2,ChevronRight,Pencil,Camera,ArrowLeft} from 'lucide-react';
import {api,session,str,rows,type RecordData} from './api';
import {Page,Field,MutationForm,Action,ErrorBox,Loading,Records} from './ui';
import {Security} from './security';
import {Support} from './domain';
import {PushSettings} from './push';
import {settingsTitles} from './settingsNavigation';

const groups=[
 {name:'Account settings',items:[['account','Personal information & preferences',UserRound],['privacy','Manage your privacy and safety',ShieldCheck],['notifications','Control your notifications',Bell],['appearance','Display & accessibility',Palette],['language','App language & translations',Globe]]},
 {name:'Communication',items:[['communications','Email, SMS & messaging',MessageCircle],['community','Your community experience',Users]]},
 {name:'Data & security',items:[['data','Manage your data and storage',Cloud],['security','Password, 2FA & active sessions',LockKeyhole],['support','Get help and contact support',HelpCircle],['about','App version and information',Info]]},
 {name:'Account actions',items:[['password','Update your password',KeyRound],['two-factor','Add extra security to your account',ShieldCheck],['sessions','Manage your signed-in devices',Monitor]]}
] as const;
function SettingsLink({id,description,Icon}:{id:string;description:string;Icon:typeof UserRound}){return <Link className={'settings-row'+(id==='delete'?' settings-danger':'')} to={'/settings/'+id}><span className="settings-row-icon"><Icon size={21}/></span><span className="settings-row-text"><strong>{settingsTitles[id]}</strong><small>{description}</small></span><ChevronRight size={18}/></Link>}

export function SettingsPage(){
 const location=useLocation(),section=location.pathname.split('/')[2]||'';
 const user=useQuery({queryKey:['/users/me'],queryFn:({signal})=>api.get<RecordData>('/users/me',signal)});
 if(section)return <Page title={settingsTitles[section]||'Settings'}><div className="settings-detail"><Link className="settings-back" to="/settings"><ArrowLeft size={17}/>All settings</Link><SettingsDetail key={section} section={section}/></div></Page>;
 const u=user.data,name=[u?.FirstName,u?.LastName].filter(Boolean).join(' '),initials=[str(u?.FirstName)[0],str(u?.LastName)[0]].filter(Boolean).join(''),joined=u?.CreatedAt?new Date(str(u.CreatedAt)).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'';
 return <Page title="Settings" subtitle="Manage your account, preferences and community experience."><div className="settings-dashboard">
  {user.isPending?<Loading/>:user.error?<ErrorBox error={user.error}/>:<section className="settings-profile"><div className="settings-photo">{u?.ProfileImage?<img src={api.asset(str(u.ProfileImage))} alt={name}/>:<span>{initials}</span>}<Link to="/profile?edit=1" aria-label="Change profile photo"><Camera size={16}/></Link></div><div className="settings-profile-info"><h2>{name}</h2><p>{str(u?.Email)}</p>{joined&&<small>Member since {joined}</small>}</div><Link className="button settings-edit" to="/profile?edit=1"><Pencil size={16}/>Edit profile</Link></section>}
  {groups.map(group=><section className="settings-group" key={group.name}><h2>{group.name}</h2><div className="settings-list">{group.items.map(([id,description,Icon])=><SettingsLink key={id} id={id} description={description} Icon={Icon}/>)}</div></section>)}
  <div className="settings-list"><SettingsLink id="delete" description="Delete your account and personal information" Icon={Trash2}/></div>
 </div></Page>;
}

function SettingsDetail({section}:{section:string}){
 if(section==='account')return <AccountSettings/>;
 if(section==='privacy')return <PrivacySettings/>;
 if(section==='notifications')return <><PushSettings/><Preferences kind="notifications"/></>;
 if(section==='appearance')return <Appearance/>;
 if(section==='language')return <section className="card"><h2>App language</h2><p>English is the currently available interface language. Other translations are not available yet.</p><MutationForm label="Request a translation" onSubmit={d=>api.send('/me/support-tickets',{category:'GENERAL',subject:'Language request: '+d.language,message:'Please add the following interface language to CDA Connect: '+d.language})}><Field name="language" label="Language you would like to use"/></MutationForm></section>;
 if(section==='communications')return <CommunicationsSettings/>;
 if(section==='community')return <><p>Manage your communities and the updates you receive.</p><Link className="button" to="/communities">Manage my communities</Link><Link className="button" to="/communities?discover=1">Discover communities</Link><Preferences kind="notifications"/></>;
 if(section==='data')return <DataSettings/>;
 if(section==='security')return <div className="settings-list">{groups[3].items.map(([id,description,Icon])=><SettingsLink key={id} id={id} description={description} Icon={Icon}/>)}</div>;
 if(section==='support')return <><p>Submit a ticket below or email <a href="mailto:support@cdaconnect.org">support@cdaconnect.org</a>.</p><Support/></>;
 if(section==='about')return <section className="card"><h2>CDA Connect</h2><p>Your community, connected.</p><p>Version {packageInfo.version}</p><p>Connect with neighbours, participate in community decisions and stay informed.</p><Link className="button" to="/settings/support">Contact support</Link><Link className="button" to="/settings/privacy">Privacy controls</Link></section>;
 if(section==='password')return <section className="card"><p>Use at least 8 characters, including an uppercase letter, number and special character. Changing your password revokes your other sessions.</p><MutationForm label="Update password" onSubmit={d=>api.send('/auth/password',{...d,refreshToken:session.get()?.refreshToken},'PUT')}><Field name="currentPassword" label="Current password" type="password"/><Field name="newPassword" label="New password" type="password"/></MutationForm></section>;
 if(section==='two-factor')return <Security section="two-factor"/>;
 if(section==='sessions')return <Security section="sessions"/>;
 if(section==='delete')return <DeleteAccount/>;
 return <p>This settings page does not exist. Use All settings to return.</p>;
}

function ContactDetails(){const q=useQuery({queryKey:['/users/me'],queryFn:()=>api.get<RecordData>('/users/me')});return <section className="card"><h2>Contact details</h2>{q.isPending?<Loading/>:q.error?<ErrorBox error={q.error}/>:<><p>Email: {str(q.data.Email)}</p><p>Phone: {str(q.data.Phone)||'Not provided'}</p><Link className="button" to="/profile?edit=1">Edit contact details</Link><p className="muted">Email changes require assistance from support. Account verification and security messages are sent when needed.</p></>}</section>}

const privacyFields=[['phoneVisibility','Phone number visibility'],['emailVisibility','Email address visibility'],['whoCanMessage','Who can message you'],['whoCanAddToGroups','Who can add you to groups']] as const;
const notificationFields=[['directMessages','Direct messages'],['mentions','Mentions'],['communityPosts','Community posts'],['polls','Polls'],['events','Events'],['marketplace','Marketplace'],['businessPromotions','Business promotions']] as const;
const titleCase=(s:string)=>s[0].toUpperCase()+s.slice(1);
function Preferences({kind}:{kind:'privacy'|'notifications'|'communications'}){
 const q=useQuery({queryKey:['/me/preferences'],queryFn:({signal})=>api.get<RecordData>('/me/preferences',signal)});
 if(q.isPending)return <Loading/>;if(q.error)return <ErrorBox error={q.error}/>;
 const privacy=(q.data.privacy||{}) as RecordData,n=(q.data.notifications||{}) as RecordData,app=(q.data.app||{}) as RecordData;
 if(kind!=='notifications'){
  const defaults=Object.fromEntries(privacyFields.map(([k])=>[k,str(privacy[titleCase(k)])||(k==='whoCanMessage'?'MEMBERS':'ADMINS')]));
  const booleans=['showOnlineStatus','showProfilePhoto','allowCommunityDiscovery'] as const;
  return <section className="card"><h2>Privacy preferences</h2><p>These controls apply to community member details. Community administrators can still access those details for administration.</p><MutationForm label="Save preferences" onSubmit={d=>api.send('/me/privacy-preferences',{...defaults,...Object.fromEntries(booleans.map(k=>[k,privacy[titleCase(k)]===undefined?true:Boolean(privacy[titleCase(k)])])),...d,...(kind==='privacy'?{showProfilePhoto:d.showProfilePhoto==='yes'}:{})},'PUT')}>
   {privacyFields.filter(([k])=>k==='phoneVisibility'||k==='emailVisibility').map(([key,label])=><label key={key}>{label}<select name={key} defaultValue={defaults[key]}><option value="NOBODY">Nobody</option><option value="ADMINS">Community admins</option><option value="MEMBERS">Community members</option></select></label>)}
   {kind==='privacy'&&(['showProfilePhoto'] as const).map((key,i)=><label key={key}>{['Show photo in member details'][i]}<select name={key} defaultValue={privacy[titleCase(key)]===false||privacy[titleCase(key)]===0?'no':'yes'}><option value="yes">Yes</option><option value="no">No</option></select></label>)}
  </MutationForm></section>;
 }
 return <section className="card"><h2>Community notifications</h2><p>Emergency alerts stay enabled. Home-screen push uses a private, generic preview.</p>{Object.values(n).some(v=>v==='DAILY'||v==='WEEKLY')&&<p>Saving this form replaces legacy digest settings with your selected On or Off delivery choices.</p>}<MutationForm label="Save notification preferences" onSubmit={d=>{
  if(d.quietHoursEnabled==='yes'&&(!d.quietStart||!d.quietEnd||d.quietStart===d.quietEnd))throw Error('Choose different start and end times for quiet hours.');
  return api.send('/me/notification-preferences',{...d,emergencyAlerts:'ALWAYS',quietHoursEnabled:d.quietHoursEnabled==='yes',quietStart:d.quietStart||undefined,quietEnd:d.quietEnd||undefined,notificationPreviewsEnabled:Boolean(app.NotificationPreviewsEnabled)},'PUT');
 }}>
 {notificationFields.map(([key,label])=><label key={key}>{label}<select name={key} defaultValue={n[titleCase(key)]==='OFF'?'OFF':n[titleCase(key)]?'ON':(['marketplace','businessPromotions'].includes(key)?'OFF':'ON')}><option value="ON">On</option><option value="OFF">Off</option></select></label>)}
 <label>Quiet hours<select name="quietHoursEnabled" defaultValue={n.QuietHoursEnabled?'yes':'no'}><option value="no">Off</option><option value="yes">On</option></select></label>
 <div className="form-grid"><Field name="quietStart" label="Start time" type="time" required={false} defaultValue={str(n.QuietStart).match(/\d\d:\d\d/)?.[0]||'22:00'}/><Field name="quietEnd" label="End time" type="time" required={false} defaultValue={str(n.QuietEnd).match(/\d\d:\d\d/)?.[0]||'07:00'}/></div>
 <Field name="timeZone" label="Time zone" defaultValue={str(app.TimeZone)||Intl.DateTimeFormat().resolvedOptions().timeZone}/>
 </MutationForm></section>;
}

type DisplayPreferences={largeText:boolean;reduceMotion:boolean};
export function applyDisplayPreferences(){try{const p=JSON.parse(localStorage.getItem('cda-display')||'{}');document.documentElement.classList.toggle('cda-large-text',Boolean(p.largeText));document.documentElement.classList.toggle('cda-reduce-motion',Boolean(p.reduceMotion))}catch{}}
function Appearance(){const[p,setP]=useState<DisplayPreferences>(()=>{try{return JSON.parse(localStorage.getItem('cda-display')||'{}')}catch{return{largeText:false,reduceMotion:false}}}),[message,setMessage]=useState('');function update(key:keyof DisplayPreferences,value:boolean){const next={...p,[key]:value};try{localStorage.setItem('cda-display',JSON.stringify(next));setP(next);applyDisplayPreferences();setMessage('Display preference saved on this device.')}catch{setMessage('Unable to save this preference on this device.')}}return <section className="card"><h2>Display & accessibility</h2><p>CDA Connect keeps its original navy, blue and green theme.</p><div className="settings-switches"><label><span>Larger text<small>Increase text size for easier reading.</small></span><input type="checkbox" checked={Boolean(p.largeText)} onChange={e=>update('largeText',e.target.checked)}/></label><label><span>Reduce motion<small>Reduce interface animation on this device.</small></span><input type="checkbox" checked={Boolean(p.reduceMotion)} onChange={e=>update('reduceMotion',e.target.checked)}/></label></div><p role="status">{message}</p></section>}

function DataSettings(){const[requested,setRequested]=useState(false);return <><section className="card"><h2>Your account data</h2><p>Request a copy of your personal data. Support processes export requests; this is not an immediate download.</p><Action run={async()=>{await api.send('/me/data-export');setRequested(true)}}>Request data export</Action>{requested&&<p role="status">Your export request has been recorded. Contact support to check its progress.</p>}<Link className="button" to="/settings/support">Check an export request</Link></section><section className="card"><h2>Public offline cache</h2><p>Clear the app’s public offline fallback. This keeps your account, messages and sign-in session.</p><ClearPublicCache/></section></>}
function ClearPublicCache(){const[message,setMessage]=useState(''),[busy,setBusy]=useState(false);return <><button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{if(!('caches' in window))throw Error('Offline cache is not available on this device.');const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('cda-v2-public-')).map(k=>caches.delete(k)));setMessage('Public offline cache cleared.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to clear cache.')}finally{setBusy(false)}}}>Clear public cache</button><p role="status">{message}</p></>}

function DeleteAccount(){const nav=useNavigate(),qc=useQueryClient();return <section className="card settings-delete"><p>This permanently removes your personal profile and anonymises your messages and posts. Some community records may remain without your personal profile. This cannot be undone.</p><MutationForm label="Permanently delete my account" onSubmit={async d=>{if(d.confirmation!=='DELETE')throw Error('Type DELETE to confirm.');return api.send('/me/delete-account',d)}} onSuccess={()=>{session.set(null);qc.clear();nav('/login',{replace:true})}}><Field name="password" label="Current password" type="password"/><Field name="confirmation" label="Type DELETE to confirm"/></MutationForm><Link className="button" to="/settings">Keep my account</Link></section>}
