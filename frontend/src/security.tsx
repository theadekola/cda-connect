import {getLocale} from './i18n';
import {TwoFactorSettings} from './TwoFactorSettings';
import {useQuery} from '@tanstack/react-query';
import {api,session,str,rows,type RecordData} from './api';
import {Action,ErrorBox,Loading} from './ui';

export function Security({section='two-factor'}:{section?:'two-factor'|'sessions'}){
 const devices=useQuery({queryKey:['/auth/security'],queryFn:()=>api.get<RecordData>('/auth/security'),enabled:section==='sessions'});
 if(section==='sessions')return <section className="card"><h2>Signed-in devices</h2><p>Revoking a session blocks further authenticated requests from that device.</p>{devices.isPending?<Loading/>:devices.error?<ErrorBox error={devices.error}/>:<>
 {rows(devices.data.activeSessions).map(r=><div className="settings-session" key={str(r.Id)}><div><strong>{r.IsCurrent?'This device':'Another session'}</strong><p>Signed in {new Date(str(r.CreatedAt)).toLocaleString(getLocale())}</p><small>Expires {new Date(str(r.ExpiresAt)).toLocaleString(getLocale())}</small></div>{!r.IsCurrent&&<Action danger run={()=>api.send('/auth/sessions/'+r.Id+'/revoke',{})}>Revoke session</Action>}</div>)}
 {!rows(devices.data.activeSessions).length&&<p>No active sessions were returned.</p>}
 {rows(devices.data.activeSessions).some(r=>!r.IsCurrent)&&<Action danger run={()=>api.send('/auth/sign-out-other-sessions',{})}>Sign out all other sessions</Action>}
 </>}</section>;
 return <TwoFactorSettings/>;
}
