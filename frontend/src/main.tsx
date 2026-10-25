import {clearTemporaryExports} from './storageLocal';
import {updateNativeChrome} from './nativeChrome';
import {NativeLinks} from './NativeLinks';
import {AnalyticsPreferences,CookieNotice} from './AnalyticsPreferences';
import {LegalStatement} from './LegalStatement';
import {AccountDeletionPage} from './AccountDeletionPage';
import {CommunityInvite} from './CommunityInvitation';
import {startUsageMeter} from './storageDevice';
import {LanguageSync} from './language';
import {useLocale,applyLanguage,getLocale} from './i18n';
const MemberProfile=lazy(()=>import('./account').then(m=>({default:m.MemberProfile})));

import {applyDisplayPreferences} from './displayPreferences';
import React,{Suspense,lazy,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Capacitor} from '@capacitor/core';
import {Protected,Welcome,Login,Register,Recovery,useSession} from './auth';
import {ApiError,session,restoreSession} from './api';
import {Loading} from './ui';
import './styles.css';
import './responsive.css';
import './tab-controls.css';
import './marketplace.css';
import './styles/super-admin.css';
const AdminAccount=lazy(()=>import('./SuperAdminDashboard').then(m=>({default:m.AdminAccount})));
const AdminCommunities=lazy(()=>import('./SuperAdminDashboard').then(m=>({default:m.AdminCommunities})));
const AdminDetail=lazy(()=>import('./SuperAdminDashboard').then(m=>({default:m.AdminDetail})));
const AdminOverview=lazy(()=>import('./SuperAdminDashboard').then(m=>({default:m.AdminOverview})));
const AdminSection=lazy(()=>import('./SuperAdminDashboard').then(m=>({default:m.AdminSection})));
const AdminUsers=lazy(()=>import('./SuperAdminDashboard').then(m=>({default:m.AdminUsers})));
const SuperAdminLogin=lazy(()=>import('./SuperAdminDashboard').then(m=>({default:m.SuperAdminLogin})));
const SuperAdminShell=lazy(()=>import('./SuperAdminDashboard').then(m=>({default:m.SuperAdminShell})));
type PageName='Home'|'Communities'|'Join'|'CreateCommunity'|'Community'|'Comments'|'Poll'|'Notifications'|'Profile'|'SettingsPage';
const page=(key:PageName)=>lazy(()=>import('./pages').then(m=>({default:m[key]})));
const Home=page('Home'),Communities=page('Communities'),Join=page('Join'),CreateCommunity=page('CreateCommunity'),Community=page('Community'),Comments=page('Comments'),Poll=page('Poll'),Notifications=page('Notifications'),Profile=page('Profile'),SettingsPage=page('SettingsPage');
const AiAssistant=lazy(()=>import('./AiAssistant').then(m=>({default:m.AiAssistant})));
const Chat=lazy(()=>import('./chat').then(m=>({default:m.Chat})));
const Shell=lazy(()=>import('./shell').then(m=>({default:m.Shell})));
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:(count,error)=>!(error instanceof ApiError&&[400,401,403,404].includes(error.status))&&count<1},mutations:{retry:false}}});
void clearTemporaryExports();
let cachedUserId=session.get()?.user.Id;
session.subscribe(()=>{const next=session.get()?.user.Id;if(next!==cachedUserId){queryClient.clear();void clearTemporaryExports();cachedUserId=next}});
class Boundary extends React.Component<React.PropsWithChildren,{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true}}render(){return this.state.failed?<main className="page"><h1>This page could not load</h1><p>Reload to load the latest version.</p><button onClick={()=>location.reload()}>Reload</button></main>:this.props.children}}
function RouteViewport(){const {pathname}=useLocation();const current=useSession();useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});const authenticated=Boolean(current)&&!isPublicPath(pathname);document.documentElement.classList.toggle('authenticated-screen',authenticated);updateNativeChrome(authenticated);return()=>document.documentElement.classList.remove('authenticated-screen')},[pathname,current?.user.Id]);return <div className="app-status-surface" aria-hidden="true"/>}
function App(){useLocale();return <Boundary><QueryClientProvider client={queryClient}><BrowserRouter><RouteViewport/><NativeLinks/><LanguageSync/><Suspense fallback={<Loading fullscreen/>}><Routes><Route path="/privacy" element={<main className="page narrow"><h1>Privacy</h1><LegalStatement kind="privacy"/></main>}/><Route path="/terms" element={<main className="page narrow"><h1>Terms</h1><LegalStatement kind="terms"/></main>}/><Route path="/account-deletion" element={<AccountDeletionPage/>}/><Route path="/cookies" element={<CookieNotice/>}/><Route path="/contact" element={<main className="page narrow"><h1>Contact</h1><a href="mailto:support@cdaconnect.org">support@cdaconnect.org</a></main>}/><Route path="/" element={<Welcome/>}/><Route path="/login" element={<Login/>}/><Route path="/super-admin/login" element={<SuperAdminLogin/>}/><Route path="/invite/:code" element={<CommunityInvite/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot-password" element={<Recovery/>}/><Route element={<Protected/>}><Route path="/super-admin" element={<SuperAdminShell/>}><Route index element={<AdminOverview/>}/><Route path="users" element={<AdminUsers/>}/><Route path="users/:userId" element={<AdminDetail kind="users"/>}/><Route path="communities" element={<AdminCommunities/>}/><Route path="communities/:communityId" element={<AdminDetail kind="communities"/>}/><Route path=":section" element={<AdminSection/>}/><Route path="finance/payments/:paymentId" element={<AdminSection/>}/><Route path="account" element={<AdminAccount/>}/></Route><Route element={<Shell/>}><Route path="/home" element={<Home/>}/><Route path="/communities" element={<Communities/>}/><Route path="/communities/join" element={<Join/>}/><Route path="/communities/create" element={<CreateCommunity/>}/><Route path="/community/:id/edit" element={<CreateCommunity/>}/><Route path="/community/:id/:section" element={<Community/>}/><Route path="/post/:id" element={<Comments/>}/><Route path="/poll/:communityId/:id" element={<Poll/>}/><Route path="/chat/:id" element={<Chat/>}/><Route path="/notifications" element={<Notifications/>}/><Route path="/ai" element={<AiAssistant/>}/><Route path="/profile/*" element={<Profile/>}/><Route path="/member/:id" element={<MemberProfile/>}/><Route path="/settings/*" element={<SettingsPage/>}/></Route></Route><Route path="*" element={<main className="page"><h1>Page not found</h1><Link to="/home">Return to home</Link></main>}/></Routes></Suspense><AnalyticsPreferences/></BrowserRouter></QueryClientProvider></Boundary>}
const installedIOS=Capacitor.getPlatform()==='ios'||((Boolean((navigator as Navigator&{standalone?:boolean}).standalone)||matchMedia('(display-mode: standalone)').matches)&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)));
document.documentElement.classList.toggle('ios-installed',installedIOS);
startUsageMeter();applyDisplayPreferences();applyLanguage(getLocale());
const render=()=>createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
function isPublicPath(pathname:string){return ['/','/login','/super-admin/login','/register','/forgot-password','/privacy','/terms','/cookies','/contact','/account-deletion'].includes(pathname)||pathname.startsWith('/invite/')}
const publicPath=isPublicPath(location.pathname);
if(publicPath){render();void restoreSession()}else void restoreSession().finally(render);
if(import.meta.env.PROD&&!Capacitor.isNativePlatform()&&'serviceWorker' in navigator){void navigator.serviceWorker.register('/sw.js').catch(()=>{/* Installation unavailable; the online application remains usable. */})}
