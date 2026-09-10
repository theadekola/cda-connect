import {settingsTitles} from './settingsNavigation';
import {HeaderTitleContext} from './pageTitle';
import {useAppRefresh} from './refresh';
import {PushSettings,disconnectPush} from './push';
import {useEffect,useRef,useState} from 'react';
import {Link,NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {House,Users,Bell,UserRound,Settings,Menu,X,LogOut,Bot,Plus,RefreshCw} from 'lucide-react';
import {api,session} from './api';
import {useSession} from './auth';

const links=[['/home','Home',House],['/communities','Communities',Users],['/ai','AI',Bot],['/notifications','Notifications',Bell],['/profile','Profile',UserRound],['/settings','Settings',Settings]] as const;
const mobileLinks=[['/home','Home',House],['/communities','Communities',Users],['/ai','AI',Bot],['/profile','Profile',UserRound],['/settings','Settings',Settings]] as const;

function pageName(path:string){
 if(path==='/home')return 'Home';
 if(path==='/communities/create')return 'Create community';
 if(path==='/communities/join')return 'Join community';
 if(path==='/communities')return 'Communities';
 if(path.startsWith('/community/'))return 'Community';
 if(path.startsWith('/post/'))return 'Conversation';
 if(path.startsWith('/poll/'))return 'Poll';
 if(path.startsWith('/chat/'))return 'Chat';
 if(path==='/ai')return 'AI';
 if(path==='/notifications')return 'Notifications';
 if(path==='/profile')return 'Profile';
 if(path.startsWith('/member/'))return 'Member profile';
 if(path==='/settings')return 'Settings';
 if(path.startsWith('/settings/'))return settingsTitles[path.split('/')[2]]||'Settings';
 return 'CDA Connect';
}

export function Shell(){
 const[open,setOpen]=useState(false),[logoutError,setLogoutError]=useState(''),[offline,setOffline]=useState(!navigator.onLine);
 const location=useLocation(),nav=useNavigate(),s=useSession(),qc=useQueryClient();
 const {surface,refresh,refreshing,distance,message:refreshMessage}=useAppRefresh(location.pathname+location.search);
 const notificationReturn=useRef('/home');
 useEffect(()=>{if(location.pathname!=='/notifications')notificationReturn.current=location.pathname+location.search+location.hash},[location.pathname,location.search,location.hash]);
 function toggleNotifications(){if(location.pathname==='/notifications')nav(notificationReturn.current,{replace:true});else nav('/notifications')}
 useEffect(()=>setOpen(false),[location.pathname]);
 useEffect(()=>{const beat=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void api.send('/users/account/presence').catch(()=>{})};beat();const timer=setInterval(beat,30000);document.addEventListener('visibilitychange',beat);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',beat)}},[]);
 useEffect(()=>{const online=()=>setOffline(!navigator.onLine);window.addEventListener('online',online);window.addEventListener('offline',online);return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',online)}},[]);
 async function logout(){if(!s)return;try{await disconnectPush();await api.send('/auth/logout',{refreshToken:s.refreshToken})}catch{setLogoutError('Server sign-out failed. Retry while online to revoke your session.');return}await qc.cancelQueries();session.set(null);qc.clear();nav('/login',{replace:true})}
 const showCommunityCreate=location.pathname==='/communities';
 return <HeaderTitleContext.Provider value={pageName(location.pathname)}><div className="app"><a className="skip" href="#main">Skip to content</a>{open&&<button className="scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}<aside className={'sidebar '+(open?'open':'')}><Link className="brand" to="/home" aria-label="CDA Connect home"><img className="brand-logo" src="/brand-logo.png" alt=""/><img className="brand-wordmark" src="/cda-wordmark-white.png" alt="CDA Connect"/></Link><button className="mobile close" onClick={()=>setOpen(false)} aria-label="Close navigation"><X/></button><p className="nav-caption">YOUR WORKSPACE</p><nav>{links.map(([path,name,Icon])=><NavLink key={path} to={path}><Icon size={20}/>{name}</NavLink>)}</nav><footer><span className="avatar">{s?.user.FirstName?.[0]}{s?.user.LastName?.[0]}</span><div><strong>{s?.user.FirstName} {s?.user.LastName}</strong><small>Community member</small></div><button aria-label="Sign out" onClick={()=>void logout()}><LogOut size={18}/></button></footer></aside><div className="workspace"><header className="topbar"><button className="mobile" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu/></button>{location.pathname==="/home"?<><strong className="topbar-title desktop-home-title">Home</strong><Link className="mobile-home-brand" to="/home" aria-label="CDA Connect home"><img src="/cda-wordmark-white.png" alt="CDA Connect"/></Link></>:<strong className="topbar-title">{pageName(location.pathname)}</strong>}<div className="top-actions"><button type="button" className="topbar-icon" aria-label="Refresh app" title="Refresh app" disabled={refreshing} onClick={()=>void refresh()}><RefreshCw size={19} className={refreshing?"refresh-spinning":undefined}/></button><Link className="desktop-community-search" to="/communities?discover=1">Find a community</Link>{showCommunityCreate&&<Link className="topbar-icon" to="/communities/create" aria-label="Create community"><Plus size={21}/></Link>}<button type="button" className="topbar-icon" aria-label={location.pathname==="/notifications"?"Close notifications":"Open notifications"} aria-expanded={location.pathname==="/notifications"} onClick={toggleNotifications}><Bell size={21}/></button><button type="button" className="topbar-icon header-signout" aria-label="Sign out" onClick={()=>void logout()}><LogOut size={19}/></button></div></header>{offline&&<p className="banner" role="status">You are offline. Reconnect before submitting changes.</p>}{logoutError&&<p className="error" role="alert">{logoutError}</p>}<div className="refresh-feedback" role="status" aria-live="polite">{refreshMessage}</div><div className="pull-refresh-indicator" aria-hidden="true" style={{height:distance}}>{distance>0&&(distance>=48?"Release to refresh":"Pull down to refresh")}</div><main ref={surface} aria-busy={refreshing} id="main" className={location.pathname==="/notifications"?"notifications-view":undefined}><Outlet/>{location.pathname==="/home"&&<PushSettings home/>}{location.pathname==="/settings"&&<div className="mobile-settings-signout"><button type="button" onClick={()=>void logout()}><LogOut size={18}/>Sign out</button></div>}</main><nav className="mobile-bottom-nav" aria-label="Primary navigation">{mobileLinks.map(([path,name,Icon])=><NavLink key={path} to={path}><Icon size={22}/><span>{name}</span></NavLink>)}</nav></div></div></HeaderTitleContext.Provider>
}




