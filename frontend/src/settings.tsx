import {HelpSupport} from './HelpSupport';
import {DeleteAccount} from './DeleteAccount';
import {ChangePassword} from './ChangePassword';
import {SecuritySettings} from './SecuritySettings';
import {StorageSettings} from './storage';
import {LanguageSettings} from './language';
import {getLocale} from './i18n';
import {CommunityPreferences} from './communityPreferences';
import {NotificationSettings} from './notificationSettings';
import {CommunicationsSettings} from './communications';
import {PrivacySettings} from './privacy';
import {AccountSettings} from './account';
import {AboutSettings} from './AboutSettings';
import {useState} from 'react';
import {Link,Navigate,useLocation,useNavigate} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {UserRound,ShieldCheck,Bell,Palette,Globe,MessageCircle,Users,Cloud,LockKeyhole,HelpCircle,Info,KeyRound,Monitor,Trash2,ChevronRight,Pencil,Camera,ArrowLeft} from 'lucide-react';
import {api,session,str,rows,type RecordData} from './api';
import {Page,Field,MutationForm,Action,ErrorBox,Loading,Records} from './ui';
import {Security} from './security';
import {Support} from './domain';
import {PushSettings} from './push';
import {settingsTitles} from './settingsNavigation';

const groups=[
 {name:'Account settings',items:[['privacy','Manage your privacy and safety',ShieldCheck],['notifications','Control your notifications',Bell],['language','App language & translations',Globe]]},
 {name:'Communication',items:[['communications','Email, SMS & messaging',MessageCircle],['community','Your community experience',Users]]},
 {name:'Data & security',items:[['data','Manage your data and storage',Cloud],['security','Password, 2FA & active sessions',LockKeyhole],['support','Get help and contact support',HelpCircle],['about','App version and information',Info]]},
] as const;
function SettingsLink({id,description,Icon}:{id:string;description:string;Icon:typeof UserRound}){return <Link className={'settings-row'+(id==='delete'?' settings-danger':'')} to={'/settings/'+id}><span className="settings-row-icon"><Icon size={21}/></span><span className="settings-row-text"><strong>{settingsTitles[id]}</strong><small>{description}</small></span><ChevronRight size={18}/></Link>}

export function SettingsPage(){
 const location=useLocation(),section=location.pathname.split('/')[2]||'';
 if(section==='account')return <Navigate to={location.pathname.replace('/settings/account','/profile/account')+location.search} replace/>;
 if(section==='appearance')return <Navigate to="/settings" replace/>;
 if(section)return <Page title={settingsTitles[section]||'Settings'}><div className="settings-detail"><SettingsDetail key={section} section={section}/></div></Page>;
 return <Page title="Settings" subtitle="Manage your account, preferences and community experience."><div className="settings-dashboard">

  {groups.map(group=><section className="settings-group" key={group.name}><h2>{group.name}</h2><div className="settings-list">{group.items.map(([id,description,Icon])=><SettingsLink key={id} id={id} description={description} Icon={Icon}/>)}</div></section>)}
 </div></Page>;
}

function SettingsDetail({section}:{section:string}){
 if(section==='account')return <AccountSettings/>;
 if(section==='privacy')return <PrivacySettings/>;
 if(section==='notifications')return <NotificationSettings/>;

 if(section==='language')return <LanguageSettings/>;
 if(section==='communications')return <CommunicationsSettings/>;
 if(section==='community')return <CommunityPreferences/>;
 if(section==='data')return <StorageSettings/>;
 if(section==='security')return <SecuritySettings/>;
 if(section==='support')return <HelpSupport/>;
 if(section==='about')return <AboutSettings/>;
 if(section==='password')return <ChangePassword/>;
 if(section==='two-factor')return <Security section="two-factor"/>;
 if(section==='sessions')return <Security section="sessions"/>;
 if(section==='delete')return <DeleteAccount/>;
 return <p>This settings page does not exist. Use the header back button to return.</p>;
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


function DataSettings(){const[requested,setRequested]=useState(false);return <><section className="card"><h2>Your account data</h2><p>Request a copy of your personal data. Support processes export requests; this is not an immediate download.</p><Action run={async()=>{await api.send('/me/data-export');setRequested(true)}}>Request data export</Action>{requested&&<p role="status">Your export request has been recorded. Contact support to check its progress.</p>}<Link className="button" to="/settings/support">Check an export request</Link></section><section className="card"><h2>Public offline cache</h2><p>Clear the app’s public offline fallback. This keeps your account, messages and sign-in session.</p><ClearPublicCache/></section></>}
function ClearPublicCache(){const[message,setMessage]=useState(''),[busy,setBusy]=useState(false);return <><button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{if(!('caches' in window))throw Error('Offline cache is not available on this device.');const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('cda-v2-public-')).map(k=>caches.delete(k)));setMessage('Public offline cache cleared.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to clear cache.')}finally{setBusy(false)}}}>Clear public cache</button><p role="status">{message}</p></>}


