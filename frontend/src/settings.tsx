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
import {PushSettings} from './push';
import {settingsTitles} from './settingsNavigation';
import {useSession} from './auth';

const groups=[
 {name:'Account settings',items:[['privacy','Manage your privacy and safety',ShieldCheck],['notifications','Control your notifications',Bell],['language','App language & translations',Globe]]},
 {name:'Communication',items:[['communications','Email, SMS & messaging',MessageCircle],['community','Your community experience',Users]]},
 {name:'Data & security',items:[['data','Manage your data and storage',Cloud],['security','Password, 2FA & active sessions',LockKeyhole],['support','Get help and contact support',HelpCircle],['about','App version and information',Info]]},
] as const;
function SettingsLink({id,description,Icon}:{id:string;description:string;Icon:typeof UserRound}){return <Link className={'settings-row'+(id==='delete'?' settings-danger':'')} to={'/settings/'+id}><span className="settings-row-icon"><Icon size={21}/></span><span className="settings-row-text"><strong>{settingsTitles[id]}</strong><small>{description}</small></span><ChevronRight size={18}/></Link>}
function AdminPageButton(){const nav=useNavigate();return <span className="settings-admin-action"><button className="settings-admin-link" type="button" onClick={()=>nav('/super-admin')}><ShieldCheck size={16}/>Admin page</button></span>}

export function SettingsPage(){
 const location=useLocation(),section=location.pathname.split('/')[2]||'',current=useSession(),isSuperAdmin=Boolean(current?.user.IsSuperAdmin);
 if(section==='account')return <Navigate to={location.pathname.replace('/settings/account','/profile/account')+location.search} replace/>;
 if(section==='appearance')return <Navigate to="/settings" replace/>;
 if(section)return <Page title={settingsTitles[section]||'Settings'}><div className="settings-detail"><SettingsDetail key={section} section={section}/></div></Page>;
 return <Page title="Settings"><div className="settings-dashboard">

  {groups.map(group=><section className="settings-group" key={group.name}><div className="settings-group-title"><h2>{group.name}</h2>{group.name==='Account settings'&&isSuperAdmin&&<AdminPageButton/>}</div><div className="settings-list">{group.items.map(([id,description,Icon])=><SettingsLink key={id} id={id} description={description} Icon={Icon}/>)}</div></section>)}
 </div></Page>;
}

function SettingsDetail({section}:{section:string}){
 if(section==='admin')return <Navigate to="/super-admin" replace/>;
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

export function applyDisplayPreferences(){try{const p=JSON.parse(localStorage.getItem('cda-display')||'{}');document.documentElement.classList.toggle('cda-large-text',Boolean(p.largeText));document.documentElement.classList.toggle('cda-reduce-motion',Boolean(p.reduceMotion))}catch{}}


