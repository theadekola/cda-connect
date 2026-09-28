import {useEffect,useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Loading,ErrorBox} from './ui';

type BankDirectory={countries:Record<string,string[]>};

export function BankSelector({country,initial=''}:{country:string;initial?:string}){
 const[bank,setBank]=useState(initial),[manual,setManual]=useState(false);
 const q=useQuery({queryKey:['bank-directory'],queryFn:async()=>{const r=await fetch('/bank-directory.json');if(!r.ok)throw Error('Bank directory unavailable. Enter the bank name manually.');return r.json() as Promise<BankDirectory>},staleTime:86400000});
 const names=useMemo(()=>new Intl.DisplayNames(['en'],{type:'region'}),[]),countries=q.data?.countries||{},normalizedCountry=country.trim().toLocaleLowerCase(),countryCode=Object.keys(countries).find(code=>code.toLocaleLowerCase()===normalizedCountry||(names.of(code)||'').toLocaleLowerCase()===normalizedCountry)||'',banks=countryCode?countries[countryCode]||[]:[];

 useEffect(()=>{if(!initial||!countryCode)return;setManual(!banks.includes(initial))},[banks,countryCode,initial]);

 return <>
  {q.isPending&&<Loading/>}
  <ErrorBox error={q.error}/>
  {!manual&&!q.error&&countryCode?<label>Bank Name<select name="bank" required value={bank} onChange={e=>{if(e.target.value==='__other'){setManual(true);setBank('')}else setBank(e.target.value)}}><option value="">Select bank</option>{banks.map(name=><option key={name}>{name}</option>)}<option value="__other">Other bank - enter name</option></select></label>:<label>Bank Name<input name="bank" required minLength={2} maxLength={150} value={bank} onChange={e=>setBank(e.target.value)}/></label>}
  <small>{countryCode?`Banks are shown for the community country, ${names.of(countryCode)||country}. Choose your bank or enter its name if it is not listed.`:`No bank directory is available for ${country||'this community country'}. Enter the bank name.`} Confirm the account details with your community.</small>
 </>
}
