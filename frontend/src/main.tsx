import {AnalyticsPreferences,CookieNotice} from './AnalyticsPreferences';
import {LegalStatement} from './LegalStatement';
import {CommunityInvite} from './CommunityInvitation';
import {startUsageMeter} from './storageDevice';
import {LanguageSync} from './language';
import {useLocale,applyLanguage,getLocale} from './i18n';
import {MemberProfile} from './account';
import {applyDisplayPreferences} from './settings';
import React,{Suspense,lazy} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Capacitor} from '@capacitor/core';
import {Protected,Welcome,Login,Register,Recovery} from './auth';
import {ApiError,session,restoreSession} from './api';
import {Loading} from './ui';
import './styles.css';
import './responsive.css';
import './tab-controls.css';
import './marketplace.css';
type PageName='Home'|'Communities'|'Join'|'CreateCommunity'|'Community'|'Comments'|'Poll'|'Notifications'|'Profile'|'SettingsPage'|'AiAssistant';
const page=(key:PageName)=>lazy(()=>import('./pages').then(m=>({default:m[key]})));
const Home=page('Home'),Communities=page('Communities'),Join=page('Join'),CreateCommunity=page('CreateCommunity'),Community=page('Community'),Comments=page('Comments'),Poll=page('Poll'),Notifications=page('Notifications'),Profile=page('Profile'),SettingsPage=page('SettingsPage'),AiAssistant=page('AiAssistant');
const Chat=lazy(()=>import('./chat').then(m=>({default:m.Chat})));
const Shell=lazy(()=>import('./shell').then(m=>({default:m.Shell})));
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:(count,error)=>!(error instanceof ApiError&&[400,401,403,404].includes(error.status))&&count<1},mutations:{retry:false}}});
let cachedUserId=session.get()?.user.Id;
session.subscribe(()=>{const next=session.get()?.user.Id;if(next!==cachedUserId){queryClient.clear();cachedUserId=next}});
class Boundary extends React.Component<React.PropsWithChildren,{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true}}render(){return this.state.failed?<main className="page"><h1>This page could not load</h1><p>Reload to load the latest version.</p><button onClick={()=>location.reload()}>Reload</button></main>:this.props.children}}
function App(){useLocale();return <Boundary><QueryClientProvider client={queryClient}><BrowserRouter><LanguageSync/><Suspense fallback={<Loading/>}><Routes><Route path="/privacy" element={<main className="page narrow"><h1>Privacy</h1><LegalStatement kind="privacy"/></main>}/><Route path="/terms" element={<main className="page narrow"><h1>Terms</h1><LegalStatement kind="terms"/></main>}/><Route path="/cookies" element={<CookieNotice/>}/><Route path="/contact" element={<main className="page narrow"><h1>Contact</h1><a href="mailto:support@cdaconnect.org">support@cdaconnect.org</a></main>}/><Route path="/" element={<Welcome/>}/><Route path="/login" element={<Login/>}/><Route path="/invite/:code" element={<CommunityInvite/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot-password" element={<Recovery/>}/><Route element={<Protected/>}><Route element={<Shell/>}><Route path="/home" element={<Home/>}/><Route path="/communities" element={<Communities/>}/><Route path="/communities/join" element={<Join/>}/><Route path="/communities/create" element={<CreateCommunity/>}/><Route path="/community/:id/:section" element={<Community/>}/><Route path="/post/:id" element={<Comments/>}/><Route path="/poll/:communityId/:id" element={<Poll/>}/><Route path="/chat/:id" element={<Chat/>}/><Route path="/notifications" element={<Notifications/>}/><Route path="/ai" element={<AiAssistant/>}/><Route path="/profile/*" element={<Profile/>}/><Route path="/member/:id" element={<MemberProfile/>}/><Route path="/settings/*" element={<SettingsPage/>}/></Route></Route><Route path="*" element={<main className="page"><h1>Page not found</h1><Link to="/home">Return to home</Link></main>}/></Routes></Suspense><AnalyticsPreferences/></BrowserRouter></QueryClientProvider></Boundary>}
startUsageMeter();applyDisplayPreferences();applyLanguage(getLocale());
const render=()=>createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
const publicPath=['/','/login','/register','/forgot-password','/privacy','/terms','/cookies','/contact'].includes(location.pathname)||location.pathname.startsWith('/invite/');
if(publicPath){render();void restoreSession()}else void restoreSession().finally(render);
if(import.meta.env.PROD&&!Capacitor.isNativePlatform()&&'serviceWorker' in navigator){void navigator.serviceWorker.register('/sw.js').catch(()=>{/* Installation unavailable; the online application remains usable. */})}
