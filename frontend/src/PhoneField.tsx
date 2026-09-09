import {useEffect,useId,useRef,useState} from 'react';
import {getCountries,getCountryCallingCode,parsePhoneNumberFromString,type CountryCode} from 'libphonenumber-js';
import {ChevronDown,Search,X,Check} from 'lucide-react';
const flags=import.meta.glob('../node_modules/flag-icons/flags/4x3/*.svg',{eager:true,query:'?url&no-inline',import:'default'}) as Record<string,string>;
function flag(code:string){return flags['../node_modules/flag-icons/flags/4x3/'+code.toLowerCase()+'.svg']}

const names=new Intl.DisplayNames(['en'],{type:'region'});
const countries=getCountries().map(code=>({code,name:names.of(code)||code,dial:getCountryCallingCode(code)})).sort((a,b)=>a.name.localeCompare(b.name));

export function PhoneField({name='phone',label='Phone number'}:{name?:string;label?:string}){
  const [country,setCountry]=useState<CountryCode>('NG'),[value,setValue]=useState(''),[search,setSearch]=useState(''),[open,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null),searchInput=useRef<HTMLInputElement>(null),id=useId();
  const selected=countries.find(c=>c.code===country)!;
  const parsed=parsePhoneNumberFromString(value,{defaultCountry:country,extract:false});
  const valid=!!parsed?.isPossible()&&!parsed.ext;
  useEffect(()=>{input.current?.setCustomValidity(value&&!valid?'Enter a valid phone number for the selected country.':'')},[value,valid,country]);
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.showModal();searchInput.current?.focus();return()=>{document.body.style.overflow=previous}},[open]);
  function close(){dialog.current?.close();setOpen(false);trigger.current?.focus()}
  const query=search.trim().toLowerCase();
  const matches=countries.filter(c=>c.name.toLowerCase().includes(query)||c.code.toLowerCase()===query||('+'+c.dial).includes(query));
  return <div className="phone-field">
    <label htmlFor={id}>{label}</label>
    <div className="phone-control"><button ref={trigger} type="button" className="country-trigger" aria-label={`Country code: ${selected.name} +${selected.dial}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setSearch('');setOpen(true)}}><img className="country-flag" src={flag(country)} alt=""/><span>+{selected.dial}</span><ChevronDown size={16}/></button>
      <input ref={input} id={id} type="tel" inputMode="tel" autoComplete="tel-national" required maxLength={40} value={value} placeholder="Your mobile number" aria-describedby={`${id}-hint`} onChange={e=>{const next=e.target.value;setValue(next);if(next.trim().startsWith('+')){const p=parsePhoneNumberFromString(next);if(p?.country)setCountry(p.country)}}}/>
    </div>
    <input type="hidden" name={name} value={valid?parsed!.number:''}/>
    <small id={`${id}-hint`}>Choose your country, then enter your number. You can also paste an international number.</small>
    <dialog ref={dialog} className="country-dialog" aria-labelledby={`${id}-title`} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();close()}}} onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}}}>
      <header><div><h2 id={`${id}-title`}>Choose country code</h2><p>Find your country or calling code.</p></div><button type="button" aria-label="Close country selector" onClick={close}><X size={20}/></button></header>
      <div className="country-search"><Search size={18}/><input ref={searchInput} aria-label="Search countries or calling codes" type="search" placeholder="Search country or code" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault()}}/></div>
      <div className="country-options">{matches.map(c=><button key={c.code} type="button" aria-pressed={country===c.code} onClick={()=>{setCountry(c.code);if(value.trim().startsWith('+'))setValue(parsed?.nationalNumber||'');close();input.current?.focus()}}><img className="country-flag" src={flag(c.code)} alt="" loading="lazy"/><span>{c.name}</span><small>+{c.dial}</small>{country===c.code&&<Check size={18}/>}</button>)}{!matches.length&&<p role="status">No countries found. Try another name or code.</p>}</div>
    </dialog>
  </div>
}

