import {DataProtection} from './OfficialGuidance';
import {LegalStatement} from './LegalStatement';
import {Link,useLocation} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Users,MessagesSquare,CalendarDays,ShieldCheck,ChartNoAxesColumn,HeartHandshake,Store,FileText,Target,Globe,Mail,Info,ChevronRight,ArrowLeft,Heart} from 'lucide-react';
import packageInfo from '../package.json';
import {api,rows,str,type RecordData} from './api';
import {Loading,ErrorBox} from './ui';
import {getLocale} from './i18n';
declare const __CDA_BUILD_TIME__:string;
const features=[
 ['Join Communities','Discover and join communities that matter to you.','/communities',Users],
 ['Stay Connected','Message, chat and engage with your community.','chat',MessagesSquare],
 ['Events & Updates','Stay informed about community events and activities.','events',CalendarDays],
 ['Stay Safe','Access privacy controls and safety tools.','/settings/privacy',ShieldCheck],
 ['Participate','Vote in polls and make your voice heard.','polls',ChartNoAxesColumn],
 ['Help & Support','Get help and contact the support team.','/settings/support',HeartHandshake],
 ['Marketplace','Browse local listings in your communities.','marketplace',Store],
 ['Resources','Find community documents and useful resources.','resources',FileText]
] as const;
const sections:Record<string,string>={chat:'conversations',events:'events',polls:'polls',marketplace:'marketplace',resources:'documents'};
const detailTitles:Record<string,string>={version:'App Version',release:'Release Information',privacy:'Privacy Policy','data-protection':'Data Protection',terms:'Terms of Service',chat:'Stay Connected',events:'Events & Updates',polls:'Participate',marketplace:'Marketplace',resources:'Resources'};
export function AboutSettings(){
 const field=useLocation().pathname.split('/')[3]||'',native=Capacitor.isNativePlatform();
 const info=useQuery({queryKey:['native-app-info'],queryFn:()=>App.getInfo(),enabled:native,retry:false});
 const communities=useQuery({queryKey:['/me/home'],queryFn:()=>api.get<RecordData>('/me/home'),enabled:!!sections[field]});
 const version=native?(info.data?.version||'Checking…'):packageInfo.version;
 const buildTime=new Date(__CDA_BUILD_TIME__).toLocaleString(getLocale());
 const row=(to:string,title:string,Icon:typeof Info,value?:string,external=false)=>{const content=<><span className="settings-row-icon"><Icon size={20}/></span><span className="settings-row-text"><strong>{title}</strong></span>{value&&<span className="privacy-value">{value}</span>}<ChevronRight size={17}/></>;return external?<a className="settings-row" href={to} target={to.startsWith('https:')?'_blank':undefined} rel="noopener noreferrer">{content}</a>:<Link className="settings-row" to={'/settings/about/'+to}>{content}</Link>};
 if(field)return <div className="about-detail"><Link className="settings-back" to="/settings/about"><ArrowLeft size={17}/>About CDA Connect</Link><h2>{detailTitles[field]||'About CDA Connect'}</h2>
 {field==='version'&&<section className="card"><h3>Installed application</h3><p>Version: {version}</p>{native&&<>{info.error&&<ErrorBox error={info.error}/>}<p>Native build: {info.data?.build||'Not available'}</p><p>Application ID: {info.data?.id||'Not available'}</p></>}<p>Web interface version: {packageInfo.version}</p><p>Platform: {native?Capacitor.getPlatform():'Web / installed web app'}</p><p>Interface built: {buildTime}</p><p>This identifies the installed build. No release service is configured to compare it with the latest available version.</p><Link className="button secondary" to="/settings/support">Get update help</Link></section>}
 {field==='release'&&<section className="card"><h3>Build information</h3><p>Interface version {packageInfo.version}</p><p>Built {buildTime}</p><p>A public release date and release history have not been supplied. The build time above records when this interface was compiled; it is not a published release date.</p><Link className="button secondary" to="/settings/support">Ask about releases</Link></section>}
 {field==='data-protection'&&<DataProtection/>}
 {(field==='privacy'||field==='terms')&&<LegalStatement kind={field}/>}
 {!!sections[field]&&<><p>Choose a community to open its {field==='chat'?'conversations':field==='resources'?'documents':field}. Access follows your community membership and permissions.</p>{communities.isPending?<Loading/>:communities.error?<ErrorBox error={communities.error}/>:rows(communities.data?.communities).length?<div className="settings-list">{rows(communities.data?.communities).map(c=><Link className="settings-row" key={str(c.Id)} to={'/community/'+c.Id+'/'+sections[field]}><span className="settings-row-icon"><Users size={20}/></span><span className="settings-row-text"><strong>{str(c.Name)}</strong></span><ChevronRight size={17}/></Link>)}</div>:<section className="card"><p>You have not joined a community yet.</p><Link className="button secondary" to="/communities">Find a community</Link></section>}</>}
 {!detailTitles[field]&&<p>This About page does not exist.</p>}</div>;
 return <div className="privacy-dashboard about-dashboard">
 <section className="about-hero"><img src="/icon-192.png" alt="CDA Connect" width="80" height="80"/><div><h2>CDA Connect</h2><Link className="about-version" to="/settings/about/version">Version {version}<ChevronRight size={14}/></Link>{info.error&&<ErrorBox error={info.error}/>}<p>Your community platform to connect, collaborate and grow together.</p></div><Users className="about-hero-art" size={72} aria-hidden="true"/></section>
 <section className="settings-group"><h2>Our Mission</h2><div className="about-mission"><span className="settings-row-icon"><Target size={30}/></span><p>To create safe, inclusive and connected communities where members can communicate, collaborate and create positive change together.</p></div></section>
 <section className="settings-group"><h2>What You Can Do</h2><div className="about-features">{features.map(([title,description,to,Icon])=><Link key={title} to={to.startsWith('/')?to:'/settings/about/'+to}><span className="settings-row-icon"><Icon size={25}/></span><strong>{title}</strong><p>{description}</p></Link>)}</div></section>
 <section className="settings-group"><h2>App Information</h2><div className="settings-list">
 {row('version','App Version',Info,version)}
 {row('release','Release Information',CalendarDays)}
 {row('https://cdaconnect.org','Website',Globe,'cdaconnect.org',true)}
 {row('mailto:support@cdaconnect.org','Email Support',Mail,'support@cdaconnect.org',true)}
 {row('privacy','Privacy Policy',ShieldCheck)}
 {row('terms','Terms of Service',FileText)}
 {row('data-protection','Data Protection',ShieldCheck)}
 </div></section><section className="about-mission about-footer"><Globe size={48} aria-hidden="true"/><div><h2>Built for Communities</h2><p>CDA Connect is built with care for communities everywhere. Thank you for being part of our mission.</p></div><Heart size={22} aria-hidden="true"/></section></div>;
}
