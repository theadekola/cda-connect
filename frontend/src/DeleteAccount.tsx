import {useState,type FormEvent} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {Trash2,UserRound,Users,MessageCircle,CalendarDays,FileText,Lightbulb,LockKeyhole,Eye,EyeOff} from 'lucide-react';
import {api,session} from './api';
import {ErrorBox} from './ui';

const effects=[
 [UserRound,'Your personal profile will be removed','Your name and contact details are cleared and your profile and cover images are unlinked.'],
 [Users,'You’ll lose access to communities','Your memberships are marked as left, your roles and membership cards are disabled, and your group chat memberships are removed.'],
 [MessageCircle,'Messages and posts will be cleared','Your message text and media links are cleared. Your posts and comments are marked as deleted.'],
 [CalendarDays,'Attendance and participation','Your meeting and event attendance records and poll votes are removed. Community events themselves remain.'],
 [FileText,'Your account cannot be restored','You cannot sign in to this deleted account again. Some community records remain linked to a deleted-member record. Stored uploads, backups and copies held by others are not erased by this action.']
] as const;
export function DeleteAccount(){
 const [password,setPassword]=useState(''),[visible,setVisible]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>();const nav=useNavigate(),qc=useQueryClient();
 async function submit(e:FormEvent){e.preventDefault();if(busy||!password||!confirmed)return;setBusy(true);setError(undefined);try{await api.send('/me/delete-account',{password,confirmation:'DELETE'});setPassword('');setConfirmed(false);session.set(null);qc.clear();nav('/login',{replace:true})}catch(e){setError(e);setBusy(false)}}
 return <div className="delete-account"><p>We’re sorry to see you go. Please read the information below before deleting your account.</p>
 <section className="delete-account-warning"><Trash2 size={48}/><div><h2>This action cannot be undone</h2><p>Deleting your account permanently removes your personal profile and prevents future access to this account. Read below to understand what is removed and retained.</p></div></section>
 <section className="settings-group"><h2>What happens when you delete your account?</h2><div className="settings-list">{effects.map(([Icon,title,text])=><div className="settings-row delete-effect" key={title}><span className="settings-row-icon"><Icon size={22}/></span><span className="settings-row-text"><strong>{title}</strong><small>{text}</small></span></div>)}</div></section>
 <section className="settings-group"><h2>Before you go</h2><div className="delete-alternative"><Lightbulb size={34}/><div><h3>Consider these options</h3><p>Deactivate your account if you need a break. Your data is retained; contact support to request reactivation.</p></div><Link className="button secondary" to="/settings/account/deactivate">Deactivate Account</Link></div><Link className="delete-download" to="/settings/account/download">Download your account data first</Link></section>
 <form onSubmit={submit}><fieldset disabled={busy}><label className="delete-password-label" htmlFor="delete-password">To continue, confirm your identity</label><div className="change-password-input"><LockKeyhole size={19} aria-hidden="true"/><input id="delete-password" name="password" type={visible?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);setError(undefined)}} placeholder="Enter your password" autoComplete="current-password" required maxLength={200}/><button type="button" className="password-eye" onClick={()=>setVisible(v=>!v)} aria-label={visible?'Hide password':'Show password'} aria-pressed={visible}>{visible?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
 <label className="delete-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/><span><strong>I understand this action is permanent</strong><small>I want to delete my account and understand the removal and retention details above.</small></span></label>
 <ErrorBox error={error}/><button className="danger delete-submit" type="submit" disabled={busy||!password||!confirmed}><Trash2 size={20}/>{busy?'Deleting account…':'Delete My Account'}</button><p role="status" className="sr-only">{busy?'Deleting your account. Please wait.':''}</p></fieldset></form>
 <Link className="delete-keep" to="/settings">Keep my account</Link></div>;
}
