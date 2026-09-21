import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {api,rows,str,type RecordData} from './api';
import {Loading,ErrorBox} from './ui';
import {PaymentReviews} from './PaymentReviews';
export function PaymentCenter({base,onReviewed}:{base:string;onReviewed:()=>Promise<void>}){
 const[tab,setTab]=useState('paid'),[page,setPage]=useState(0),qc=useQueryClient();
 const q=useQuery({queryKey:[base+'/unpaid-members',page],queryFn:()=>api.get<RecordData[]>(base+'/unpaid-members?page='+page),enabled:tab==='unpaid'});
 async function refresh(){await qc.invalidateQueries({queryKey:[base+'/unpaid-members']});await onReviewed()}
 return <section><h1>Payment records</h1><nav className="levy-tabs" aria-label="Community payment status"><button aria-pressed={tab==='paid'} onClick={()=>setTab('paid')}>Submissions</button><button aria-pressed={tab==='unpaid'} onClick={()=>setTab('unpaid')}>Unpaid</button></nav>{tab==='paid'?<PaymentReviews base={base} onReviewed={refresh}/>:<><p>Members with unpaid or partially paid levies. Transfers awaiting confirmation appear under Submissions.</p>{q.isPending?<Loading/>:q.error?<ErrorBox error={q.error}/>:rows(q.data).length?rows(q.data).map(r=><article className="levy-panel" key={str(r.Id)}><Link className="levy-review-member" to={'/member/'+r.UserId}>{!!r.ProfileImage&&<img src={api.asset(str(r.ProfileImage))} alt="Member profile"/>}<strong>{str(r.FirstName)} {str(r.LastName)}</strong></Link><h2>{str(r.PlanName)}</h2><p>Outstanding: <strong className="levy-due">{new Intl.NumberFormat('en-GB',{style:'currency',currency:str(r.CurrencyCode)||'NGN'}).format(Number(r.AmountDue)-Number(r.AmountPaid))}</strong></p><p>{Number(r.AmountPaid)>0?'Partially paid':'Unpaid'}{r.SubmissionStatus==='REJECTED'?' · Evidence declined':''}</p></article>):<p>No unpaid members.</p>}<nav className="levy-review-actions" aria-label="Unpaid member pages"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1}</span><button disabled={rows(q.data).length<25} onClick={()=>setPage(p=>p+1)}>Next</button></nav></>}</section>
}
