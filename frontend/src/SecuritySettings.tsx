import {useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ShieldCheck,LockKeyhole,Monitor,KeyRound,Mail,UserRound,LogOut,Bell,MapPin,Fingerprint,LifeBuoy,ChevronRight,ArrowLeft,ShieldAlert} from 'lucide-react';
import {api,session,str,rows,type RecordData} from './api';
import {Action,ErrorBox,Loading,MutationForm} from './ui';
import {VerificationCode} from './VerificationCode';
import {TrustedDevices} from './privacy';
import {Security} from './security';
import {getLocale} from './i18n';

const titles:Record<string,string>={devices:'Trusted Devices',activity:'Login Activity',email:'Email Security',sessions:'Active Sessions',signout:'Sign Out of Other Devices',locations:'Trusted Locations',biometric:'Biometric Login',recovery:'Account Recovery',learn:'Keep Your Account Secure'};
const date=(value:unknown)=>value?new Date(str(value)).toLocaleString(getLocale()):'Not recorded';
export function SecuritySettings(){
 const field=useLocation().pathname.split('/')[3]||'',qc=useQueryClient(),[notice,setNotice]=useState(''),[error,setError]=useState<unknown>(),[saving,setSaving]=useState(false);
 const q=useQuery({queryKey:['/auth/security-settings'],queryFn:()=>api.get<RecordData>('/auth/security-settings')});
 const sessions=useQuery({queryKey:['/auth/security'],queryFn:()=>api.get<RecordData>('/auth/security')});
 const activity=useQuery({queryKey:['/auth/login-activity'],queryFn:()=>api.get<RecordData[]>('/auth/login-activity'),enabled:field==='activity'});
 const u=q.data,active=rows(sessions.data?.activeSessions),trusted=active.filter(x=>x.TrustedName),findings=Array.isArray(u?.findings)?u.findings as string[]:[];
 const link=(to:string,title:string,description:string,Icon:typeof Mail,value?:string)=><Link className="settings-row" to={to.startsWith('/')?to:'/settings/security/'+to}><span className="settings-row-icon"><Icon size={21}/></span><span className="settings-row-text"><strong>{title}</strong><small>{description}</small></span>{value&&<span className="privacy-value">{value}</span>}<ChevronRight size={17}/></Link>;
 async function saveAlerts(enabled:boolean){setSaving(true);setError(undefined);try{await api.send('/auth/security-settings',{loginAlerts:enabled},'PATCH');await qc.invalidateQueries({queryKey:['/auth/security-settings']});setNotice(enabled?'Login email alerts enabled.':'Login email alerts disabled.')}catch(e){setError(e)}finally{setSaving(false)}}
 const alerts=<label className="settings-row account-switch-row"><span className="settings-row-icon"><Bell size={21}/></span><span className="settings-row-text"><strong>Login Alerts</strong><small>Email me after successful new sign-ins</small></span><input type="checkbox" role="switch" checked={!!u?.LoginAlerts} disabled={saving||!u} onChange={e=>void saveAlerts(e.target.checked)}/></label>;
 const feedback=<>{error!=null&&<ErrorBox error={error}/>}<p className="privacy-status" role="status">{notice}</p></>;
 if(q.isPending)return <Loading/>;if(q.error)return <ErrorBox error={q.error}/>;
 if(field)return <div className="security-detail"><Link className="settings-back" to="/settings/security"><ArrowLeft size={17}/>Security</Link><h2>{titles[field]||'Security'}</h2>{feedback}
 {field==='devices'&&<TrustedDevices/>}
 {field==='sessions'&&<Security section="sessions"/>}
 {field==='activity'&&<><p>Latest 100 retained sign-in sessions. Refreshing a session does not create a new login entry. Device names are labels you provide; location and browser history are not collected here.</p>{activity.isPending?<Loading/>:activity.error?<ErrorBox error={activity.error}/>:!activity.data?.length?<p>No retained login activity.</p>:activity.data.map(r=><section className="card" key={str(r.Id)}><strong>{str(r.TrustedName)||'Sign-in session'}</strong><p>{date(r.CreatedAt)}</p><small>{r.RevokedAt?'Revoked '+date(r.RevokedAt):new Date(str(r.ExpiresAt)).getTime()<=Date.now()?'Expired':'Active'}</small></section>)}<Link className="button secondary" to="/settings/security/sessions">Manage active sessions</Link></>}
 {field==='email'&&<><section className="card"><h3>Email verification</h3><p className="security-contact">{str(u?.Email)}</p><p>{u?.EmailVerified?'Verified':'Not verified'}</p>{!u?.EmailVerified&&<VerifyContact method="email"/>}<Link to="/settings/account/email">Change email address</Link></section><div className="settings-list">{alerts}</div><p>Login alerts are separate from community email preferences. They require a verified address and configured email delivery. Delivery is attempted once in the background; interrupted attempts are not retried.</p><p>Last alert attempt: {date(u?.LastLoginAlertAt)}. {u?.LastLoginAlertStatus==='ACCEPTED'?'Accepted by email provider; inbox delivery is not guaranteed.':u?.LastLoginAlertStatus==='FAILED'?'Delivery failed. Contact support if this continues.':u?.LastLoginAlertStatus==='PENDING'?'Delivery is pending or was interrupted.':''}</p>{!u?.emailAvailable&&<p role="status">Email delivery is not configured on the server.</p>}</>}
 {field==='signout'&&<><p>Revoke all other refresh sessions while keeping this session. They will need to sign in again.</p>{sessions.error?<ErrorBox error={sessions.error}/>:sessions.isPending?<Loading/>:active.some(r=>!r.IsCurrent)?<Action danger run={async()=>{const r=await api.send<RecordData>('/auth/sign-out-other-sessions',{});setNotice(`${r.signedOut} other sessions revoked.`)}}>Sign out other devices</Action>:<p>No other active sessions.</p>}</>}
 {field==='locations'&&<><p>Location-based authentication is not available in this build. No locations are trusted and your location never bypasses your password or two-factor authentication.</p><Link className="button secondary" to="/settings/security/activity">Review login activity</Link><Link className="button secondary" to="/settings/two-factor">Manage two-factor authentication</Link></>}
 {field==='biometric'&&<><p>Fingerprint, Face ID and passkey sign-in are not integrated in this build. Your device may offer biometric approval for its password manager, which is controlled in your device settings.</p><p>CDA Connect continues to require your password and, when enabled, your two-factor code.</p><Link className="button secondary" to="/settings/two-factor">Set up two-factor authentication</Link></>}
 {field==='recovery'&&<><p>Password recovery currently uses an SMS code sent to the phone number on your account. Keep that number up to date. If you cannot access it, contact support; this page cannot bypass authentication.</p><section className="card"><h3>Recovery phone</h3><p>{str(u?.Phone)||'No phone number added'}</p><p>{u?.PhoneVerified?'Verified':'Not verified'}</p>{!!u?.Phone&&!u.PhoneVerified&&<VerifyContact method="phone"/>}<Link to="/settings/account/phone">Update phone number</Link></section><Link className="button secondary" to="/settings/support">Contact support</Link></>}
 {field==='learn'&&<><p>Use a unique password and enable two-factor authentication. Keep your recovery phone available. Review active sessions and revoke any you do not recognise.</p><p>Never share passwords or verification codes. The security check reviews account settings and delivery status; it does not scan your device, detect every compromise or assess your existing password’s strength.</p><Link className="button secondary" to="/settings/support">Contact support</Link></>}
 {!titles[field]&&<p>This security page does not exist.</p>}
 </div>;
 return <div className="privacy-dashboard security-dashboard"><p>Manage your account security and keep your data safe.</p>{feedback}
 <section className="security-hero"><ShieldCheck size={58}/><div><h2>{findings.length?'Review your account protection':'Account checks completed'}</h2><p>Last checked: {date(u?.checkedAt)}</p><small>{findings.length?`${findings.length} recommendation${findings.length===1?'':'s'} to review`:'No issues found in the checks below'}</small></div><Action run={async()=>{const result=await q.refetch();if(result.error)throw result.error;await sessions.refetch();setNotice('Account security settings checked.')}}>Run Security Check</Action></section>
 {findings.length>0&&<ul className="security-findings">{findings.map(f=><li key={f}>{f}</li>)}</ul>}
 <section className="settings-group"><h2>Account Protection</h2><div className="settings-list">
 {link('/settings/password','Password','Change your sign-in password',LockKeyhole,u?.PasswordChangedAt?'Updated '+date(u.PasswordChangedAt):'Update date unknown')}
 {link('/settings/two-factor','Two-Factor Authentication','Add an extra layer of security',ShieldCheck,u?.TwoFactorEnabled?'On':'Off')}
 {link('devices','Trusted Devices','Name and manage recognised sessions',Monitor,sessions.data?`${trusted.length} device${trusted.length===1?'':'s'}`:'Checking…')}
 {link('activity','Login Activity','Review recent sign-ins to your account',KeyRound)}
 {link('email','Email Security','Email verification and login alerts',Mail,u?.EmailVerified?'Verified':'Not verified')}
 </div></section>
 <section className="settings-group"><h2>Session Management</h2><div className="settings-list">
 {link('sessions','Active Sessions','Review where you are signed in',UserRound,sessions.data?`${active.length} active`:'Checking…')}
 {link('signout','Sign out of other devices','Keep only your current refresh session',LogOut)}
 </div>{sessions.error&&<ErrorBox error={sessions.error}/>}</section>
 <section className="settings-group"><h2>Advanced Security</h2><div className="settings-list">{alerts}
 {link('locations','Trusted Locations','Location-based trust is not configured',MapPin,'Unavailable')}
 {link('biometric','Biometric Login','Fingerprint and Face ID sign-in',Fingerprint,'Unavailable')}
 {link('recovery','Account Recovery','Manage your recovery phone and support options',LifeBuoy)}
 </div></section><aside className="privacy-safety security-help"><ShieldAlert size={36}/><div><strong>Keep your account secure</strong><p>Never share your password or verification codes with anyone.</p></div><Link className="button secondary" to="/settings/security/learn">Learn More</Link></aside></div>;
}
function VerifyContact({method}:{method:'email'|'phone'}){
 const [challenge,setChallenge]=useState('');
 return challenge?<MutationForm label="Verify code" onSuccess={()=>setChallenge('')} onSubmit={d=>api.send('/auth/account-verification/verify',{method,challengeId:challenge,code:d.code})}><VerificationCode/><button type="button" onClick={()=>setChallenge('')}>Request another code</button></MutationForm>:<Action run={async()=>{const r=await api.send<RecordData>('/auth/account-verification/request',{method});if(!r.alreadyVerified)setChallenge(str(r.challengeId))}}>Send verification code</Action>;
}
