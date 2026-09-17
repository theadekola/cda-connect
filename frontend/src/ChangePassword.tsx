import {useState,type FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {LockKeyhole,ShieldCheck,Eye,EyeOff,CheckCircle2,Circle,Lightbulb} from 'lucide-react';
import {api,session} from './api';
import {ErrorBox} from './ui';

export function ChangePassword(){
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[visible,setVisible]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(),[notice,setNotice]=useState('');const qc=useQueryClient();
 const checks=[['At least 8 characters long',next.length>=8],['At least one uppercase letter (A–Z)',/[A-Z]/.test(next)],['At least one lowercase letter (a–z)',/[a-z]/.test(next)],['At least one number (0–9)',/\d/.test(next)],['At least one special character (!@#$%^&*)',/[^A-Za-z0-9\s]/.test(next)]] as const;
 const matches=!!confirm&&next===confirm,valid=checks.every(([,ok])=>ok),tooLong=new TextEncoder().encode(next).length>72;
 const predictable=/(password|qwerty|123456|abcdef)/i.test(next)||/(.)\1{3}/.test(next);
 const level=!next?0:!valid||predictable?1:next.length<12?2:next.length<16?3:4;
 const strength=['Not entered','Weak','Fair','Good','Strong'][level];
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setError(undefined);setNotice('');if(!valid||tooLong){setError(Error(tooLong?'Password is too long. Use fewer characters.':'Meet all five password requirements.'));return}if(next!==confirm){setError(Error('New passwords do not match.'));return}if(current===next){setError(Error('Choose a different password from your current password.'));return}setBusy(true);try{await api.send('/auth/password',{currentPassword:current,newPassword:next},'PUT');setCurrent('');setNext('');setConfirm('');setVisible({});setNotice('Password updated. Your other refresh sessions have been revoked.');await qc.invalidateQueries()}catch(e){setError(e)}finally{setBusy(false)}}
 const input=(id:string,label:string,value:string,set:(v:string)=>void,autocomplete:string)=><div className="change-password-field"><label htmlFor={id}>{label}</label><div className="change-password-input"><LockKeyhole size={19} aria-hidden="true"/><input id={id} name={id} type={visible[id]?'text':'password'} value={value} onChange={e=>{set(e.target.value);setNotice('');setError(undefined)}} autoComplete={autocomplete} placeholder={'Enter '+label.toLowerCase()} required maxLength={id==='currentPassword'?200:72} aria-describedby={id==='newPassword'?'password-requirements password-strength':id==='confirmPassword'?'password-match':undefined}/><button type="button" className="password-eye" aria-label={(visible[id]?'Hide ':'Show ')+label.toLowerCase()} aria-pressed={!!visible[id]} onClick={()=>setVisible(v=>({...v,[id]:!v[id]}))}>{visible[id]?<EyeOff size={20}/>:<Eye size={20}/>}</button></div></div>;
 return <div className="change-password"><p>Create a new password to keep your account secure.</p><section className="change-password-hero"><ShieldCheck size={52}/><div><h2>Keep your account secure</h2><p>Use a unique password that you don’t use on other websites or apps.</p></div></section>
 <form onSubmit={submit}><fieldset disabled={busy}>
 {input('currentPassword','Current Password',current,setCurrent,'current-password')}
 {input('newPassword','New Password',next,setNext,'new-password')}
 <div id="password-strength" className="password-strength" aria-live="polite"><p>Password strength estimate: <strong>{strength}</strong></p><div className={'password-strength-bars level-'+level} aria-hidden="true">{[1,2,3,4].map(n=><span key={n} className={n<=level?'filled':''}/>)}</div></div>
 {input('confirmPassword','Confirm New Password',confirm,setConfirm,'new-password')}
 <p id="password-match" className="password-match" aria-live="polite">{confirm?(matches?'Passwords match.':'Passwords do not match.'):'Re-enter your new password.'}</p>
 <section className="password-requirements" id="password-requirements"><div><h2><ShieldCheck size={22}/>Password must contain:</h2><ul>{checks.map(([label,ok])=><li key={label} className={ok?'met':''}>{ok?<CheckCircle2 size={19}/>:<Circle size={19}/>}<span className="sr-only">{ok?'Met: ':'Not met: '}</span>{label}</li>)}</ul>{tooLong&&<p role="alert">Password is too long. Use fewer characters.</p>}</div><LockKeyhole className="password-art" size={80} aria-hidden="true"/></section>
 <section className="password-tips"><Lightbulb size={32}/><div><h2>Password Tips</h2><p>Choose a longer password. Avoid personal information, common sequences and repeated characters. The strength estimate is not a guarantee.</p></div></section>
 <ErrorBox error={error}/><p role="status">{notice}</p><button className="primary password-submit" type="submit" disabled={!current||!valid||!matches||tooLong||busy}>{busy?'Updating…':'Update Password'}</button>
 <p className="password-session-note">Changing your password keeps this session and revokes other refresh sessions. Their existing access tokens remain valid until they expire.</p>
 </fieldset></form></div>;
}
