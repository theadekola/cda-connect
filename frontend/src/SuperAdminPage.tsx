import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link,Navigate,useLocation} from 'react-router-dom';
import {ShieldCheck,Users,Clock3,LockKeyhole} from 'lucide-react';
import {useSession} from './auth';
import {api,rows,str,type RecordData} from './api';
import {Action,Empty,ErrorBox,Loading,MutationForm,Field} from './ui';
import {VerificationCode} from './VerificationCode';

type MfaChallenge={enabled?:boolean;verified?:boolean;method?:string;challengeId?:string;maskedPhone?:string};

function AdminMfaGate({initial,onVerified}:{initial?:MfaChallenge;onVerified:()=>Promise<unknown>}){
 const [challenge,setChallenge]=useState<MfaChallenge|undefined>(initial);
 const request=async()=>setChallenge(await api.send<MfaChallenge>('/super-admin/mfa/challenge',{}));
 if(challenge?.enabled===false)return <section className="card admin-mfa-gate"><LockKeyhole size={30}/><h2>MFA is required</h2><p>Enable two-factor authentication before opening the Admin page.</p><Link className="button" to="/settings/two-factor">Set up MFA</Link></section>;
 if(!challenge)return <section className="card admin-mfa-gate"><LockKeyhole size={30}/><h2>Verify administrator access</h2><p>Request an MFA challenge to continue to the Admin page.</p><Action run={request}>Request MFA code</Action></section>;
 return <section className="card admin-mfa-gate"><LockKeyhole size={30}/><h2>Enter your MFA code</h2><p>{challenge.method==='sms'?`Enter the six-digit code sent to ${challenge.maskedPhone||'your verified phone'}.`:'Enter the current six-digit code from your authenticator app.'}</p><MutationForm label="Verify and open Admin page" onSuccess={onVerified} onSubmit={data=>api.send('/super-admin/mfa/verify',{code:data.code,challengeId:challenge.challengeId})}><VerificationCode/></MutationForm>{challenge.method==='sms'&&<Action run={request}>Send a new code</Action>}</section>;
}

export function SuperAdminPage(){
 const current=useSession(),location=useLocation(),allowed=Boolean(current?.user.IsSuperAdmin),initial=(location.state as {mfaChallenge?:MfaChallenge}|null)?.mfaChallenge;
 const [entryChallenge,setEntryChallenge]=useState<MfaChallenge|undefined>(initial);
 const status=useQuery({queryKey:['/super-admin/mfa/status'],queryFn:({signal})=>api.get<RecordData>('/super-admin/mfa/status',signal),enabled:allowed});
 const verified=Boolean(status.data?.verified)&&!entryChallenge;
 const users=useQuery({queryKey:['/super-admin/audit/users'],queryFn:({signal})=>api.get<RecordData[]>('/super-admin/audit/users',signal),enabled:allowed&&verified});
 const access=useQuery({queryKey:['/super-admin/access'],queryFn:({signal})=>api.get<RecordData[]>('/super-admin/access',signal),enabled:allowed&&verified});
 if(!allowed)return <Navigate to="/settings" replace/>;
 if(status.isPending)return <Loading/>;
 if(status.error)return <ErrorBox error={status.error}/>;
 if(!verified)return <AdminMfaGate initial={entryChallenge??(status.data?.enabled===false?{enabled:false}:undefined)} onVerified={async()=>{setEntryChallenge(undefined);await status.refetch()}}/>;
 const userRows=rows(users.data),accessRows=rows(access.data),active=accessRows.filter(item=>!item.RevokedAt&&Date.parse(str(item.ExpiresAt))>Date.now());
 return <div className="super-admin-page">
  <section className="admin-summary" aria-label="Platform administration summary">
   <article><Users size={20}/><strong>{users.isPending?'-':userRows.length}</strong><span>Audited users</span></article>
   <article><ShieldCheck size={20}/><strong>{userRows.filter(item=>item.IsProtectedAccount).length}</strong><span>Protected accounts</span></article>
   <article><Clock3 size={20}/><strong>{active.length}</strong><span>Active access windows</span></article>
  </section>
  <section className="card"><h2>Temporary access</h2><p>Support access is read-only for 30 minutes. Break-glass access is limited to one community for 15 minutes and every use is audited.</p><MutationForm label="Start access window" onSubmit={data=>api.send('/super-admin/access',{mode:data.mode,reason:data.reason,communityId:data.communityId||undefined})}><label>Access mode<select name="mode" defaultValue="SUPPORT"><option value="SUPPORT">Support - read-only</option><option value="BREAK_GLASS">Break-glass - community management</option></select></label><Field name="communityId" label="Community ID (required for break-glass)" required={false}/><Field name="reason" label="Reason" type="textarea"/></MutationForm>{access.isPending?<Loading/>:access.error?<ErrorBox error={access.error}/>:active.length?<div className="admin-access-list">{active.map(item=><article key={str(item.Id)}><div><strong>{str(item.AccessMode).replace('_',' ')}</strong><small>{item.CommunityId?'Community '+str(item.CommunityId):'Platform-wide'} · expires {new Date(str(item.ExpiresAt)).toLocaleString()}</small><p>{str(item.Reason)}</p></div><Action danger run={()=>api.send('/super-admin/access/'+item.Id,{},'DELETE')}>End access</Action></article>)}</div>:<p className="muted">No temporary access window is active.</p>}</section>
  <section className="card"><h2>Platform audit</h2><p>The default view excludes email, phone number, address and date of birth.</p>{users.isPending?<Loading/>:users.error?<ErrorBox error={users.error}/>:userRows.length?<div className="admin-user-list">{userRows.map(item=><article key={str(item.UserId)}><span>#{str(item.UserId)}</span><strong>{str(item.AccountStatus)}</strong>{Boolean(item.IsProtectedAccount)&&<small>Protected Super Admin</small>}{!item.IsProtectedAccount&&Boolean(item.IsSuperAdmin)&&<small>Super Admin</small>}</article>)}</div>:<Empty text="No audit users found."/>}</section>
 </div>;
}
