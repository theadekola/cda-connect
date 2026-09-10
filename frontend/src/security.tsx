import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,session,str,rows,type RecordData} from './api';
import {Action,Field,MutationForm,ErrorBox,Loading} from './ui';
import {VerificationCode} from './VerificationCode';

export function Security({section='two-factor'}:{section?:'two-factor'|'sessions'}){
 const[setup,setSetup]=useState<RecordData|null>(null),[disableChallenge,setDisableChallenge]=useState(''),[disabling,setDisabling]=useState(false);
 const q=useQuery({queryKey:['/auth/two-factor'],queryFn:()=>api.get<RecordData>('/auth/two-factor'),enabled:section==='two-factor'});
 const devices=useQuery({queryKey:['/auth/security'],queryFn:()=>api.get<RecordData>('/auth/security',undefined,{'x-refresh-token':session.get()?.refreshToken||''}),enabled:section==='sessions'});
 if(section==='sessions')return <section className="card"><h2>Signed-in devices</h2><p>Revoking a session prevents that device from renewing its sign-in. Already issued access tokens remain valid until they expire.</p>{devices.isPending?<Loading/>:devices.error?<ErrorBox error={devices.error}/>:<>
 {rows(devices.data.activeSessions).map(r=><div className="settings-session" key={str(r.Id)}><div><strong>{r.IsCurrent?'This device':'Another session'}</strong><p>Signed in {new Date(str(r.CreatedAt)).toLocaleString()}</p><small>Expires {new Date(str(r.ExpiresAt)).toLocaleString()}</small></div>{!r.IsCurrent&&<Action danger run={()=>api.send('/auth/sessions/'+r.Id+'/revoke',{refreshToken:session.get()?.refreshToken})}>Revoke session</Action>}</div>)}
 {!rows(devices.data.activeSessions).length&&<p>No active sessions were returned.</p>}
 {rows(devices.data.activeSessions).some(r=>!r.IsCurrent)&&<Action danger run={()=>api.send('/auth/sign-out-other-sessions',{refreshToken:session.get()?.refreshToken})}>Sign out all other sessions</Action>}
 </>}</section>;
 return <section className="card">{q.error?<ErrorBox error={q.error}/>:q.isPending?<Loading/>:<>
 <p>{q.data.enabled?'Enabled':'Not enabled'}{q.data.method?' - '+(q.data.method==='sms'?'SMS':'Authenticator app'):''}</p>
 {!q.data.enabled&&!setup&&<MutationForm label="Start setup" onSubmit={async d=>{setSetup(await api.send<RecordData>('/auth/two-factor/setup',d));}}><label>Method<select name="method"><option value="authenticator">Authenticator app</option><option value="sms" disabled={!q.data.phoneVerified}>SMS{!q.data.phoneVerified?' (verified phone required)':''}</option></select></label><Field name="password" label="Current password" type="password"/></MutationForm>}
 {setup&&<><p>{setup.method==='sms'?'Enter the code sent to '+str(setup.maskedPhone)+'.':'Add this setup key to your authenticator app, then enter its current six-digit code. Keep the key private.'}</p>{!!setup.secret&&<code className="settings-secret">{str(setup.secret)}</code>}<MutationForm label="Enable protection" onSuccess={()=>setSetup(null)} onSubmit={d=>api.send('/auth/two-factor/enable',{...d,method:setup.method,secret:setup.secret,challengeId:setup.challengeId,refreshToken:session.get()?.refreshToken})}><Field name="password" label="Current password" type="password"/><VerificationCode/><button type="button" onClick={()=>setSetup(null)}>Cancel setup</button></MutationForm></>}
 {!!q.data.enabled&&!disabling&&<button type="button" onClick={()=>setDisabling(true)}>Turn off two-factor authentication</button>}
 {!!q.data.enabled&&disabling&&<>{q.data.method==='sms'&&!disableChallenge?<Action run={async()=>{const r=await api.send<RecordData>('/auth/two-factor/sms-code',{purpose:'disable'});setDisableChallenge(str(r.challengeId));}}>Send verification code</Action>:<MutationForm label="Disable protection" onSuccess={()=>{setDisabling(false);setDisableChallenge('')}} onSubmit={d=>api.send('/auth/two-factor/disable',{...d,challengeId:disableChallenge||undefined,refreshToken:session.get()?.refreshToken})}><Field name="password" label="Current password" type="password"/><VerificationCode/></MutationForm>}<button type="button" onClick={()=>{setDisabling(false);setDisableChallenge('')}}>Keep protection enabled</button></>}
 </>}</section>;
}
