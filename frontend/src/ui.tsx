import {HeaderTitleContext,duplicatesHeader} from './pageTitle';
import {useContext,useState,type ReactNode,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api,rows,str,type RecordData} from './api';
export function Page({title,subtitle,action,children}:{title:string;subtitle?:string;action?:ReactNode;children:ReactNode}){
 const duplicate=duplicatesHeader(title,useContext(HeaderTitleContext));
 return <section className="page">{duplicate&&<h1 className="sr-only">{title}</h1>}{(!duplicate||subtitle||action)&&<header className={'page-heading'+(duplicate?' page-heading-deduplicated':'')}>{(!duplicate||subtitle)&&<div>{!duplicate&&<><p className="eyebrow">CDA CONNECT</p><h1>{title}</h1></>}{subtitle&&<p className="muted">{subtitle}</p>}</div>}{action}</header>}{children}</section>
}
export function ErrorBox({error}:{error:unknown}){return error?<p className="error" role="alert">{error instanceof Error?error.message:'Something went wrong.'}</p>:null}
export function Loading(){return <p role="status" className="empty">Loading…</p>}
export function Empty({text='Nothing here yet.'}:{text?:string}){return <div className="empty"><h3>{text}</h3><p>New information will appear here when it is available.</p></div>}
export function Field({name,label,type='text',required=true,defaultValue}:{name:string;label:string;type?:string;required?:boolean;defaultValue?:string}){return <label>{label}{type==='textarea'?<textarea name={name} required={required} defaultValue={defaultValue} rows={4}/>:<input name={name} type={type} required={required} defaultValue={defaultValue} step={type==='number'?'any':undefined} autoComplete={type==='password'?(name==='currentPassword'||label.toLowerCase().includes('current')?'current-password':'new-password'):type==='email'?'email':undefined}/>}</label>}
export function MutationForm({children,onSubmit,label='Save',onSuccess}:{children:ReactNode;onSubmit:(data:Record<string,string>)=>Promise<unknown>;label?:string;onSuccess?:()=>void}){
 const[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(),[done,setDone]=useState(false);const client=useQueryClient();
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError(undefined);setDone(false);const data=Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>;try{await onSubmit(data);setDone(true);await client.invalidateQueries();onSuccess?.()}catch(e){setError(e)}finally{setBusy(false)}}
 return <form onSubmit={submit} className="form"><fieldset disabled={busy}>{children}</fieldset><ErrorBox error={error}/>{done&&<p role="status" className="success">Saved successfully.</p>}<button className="primary" disabled={busy}>{busy?'Please wait…':label}</button></form>
}
export function Action({children,run,danger=false}:{children:ReactNode;run:()=>Promise<unknown>;danger?:boolean}){const[busy,setBusy]=useState(false),[error,setError]=useState<unknown>();const qc=useQueryClient();return <span><button type="button" className={danger?'danger':'secondary'} disabled={busy} onClick={async()=>{if(danger&&!window.confirm('Confirm this action?'))return;setBusy(true);setError(undefined);try{await run();await qc.invalidateQueries()}catch(e){setError(e)}finally{setBusy(false)}}}>{busy?'Please wait…':children}</button><ErrorBox error={error}/></span>}
export function Records({endpoint,render}:{endpoint:string;render?:(r:RecordData)=>ReactNode}){const q=useQuery({queryKey:[endpoint],queryFn:({signal})=>api.get<unknown>(endpoint,signal)});if(q.isPending)return <Loading/>;if(q.error)return <ErrorBox error={q.error}/>;const list=rows(q.data);return list.length?<div className="record-list">{list.map((r,i)=><article className="card" key={str(r.Id||r.MembershipId)||i}>{render?render(r):<><h3>{str(r.Title||r.Name||r.Question||r.FirstName)||'Record'}</h3><p>{str(r.Description||r.Body||r.Message)}</p></>}</article>)}</div>:<Empty/>}


