import {useId,useRef,useState} from 'react';

export function VerificationCode({name='code',label='Verification code'}:{name?:string;label?:string}){
  const [digits,setDigits]=useState<string[]>(Array(6).fill(''));
  const inputs=useRef<Array<HTMLInputElement|null>>([]),id=useId();
  function fill(value:string,index:number){
    const clean=value.replace(/\D/g,'').slice(0,6);
    if(!clean){setDigits(previous=>previous.map((digit,i)=>i===index?'':digit));return}
    const start=clean.length===6?0:index;
    setDigits(previous=>{const next=[...previous];for(let offset=0;offset<clean.length&&start+offset<6;offset++)next[start+offset]=clean[offset];return next});
    inputs.current[Math.min(start+clean.length,5)]?.focus();
  }
  return <div className="verification-code" role="group" aria-labelledby={`${id}-label`}>
    <span id={`${id}-label`} className="verification-code-label">{label}</span>
    <div className="verification-digits">{digits.map((digit,index)=><input key={index} ref={element=>{inputs.current[index]=element}} aria-label={`Digit ${index+1} of 6`} aria-describedby={`${id}-hint`} type="text" inputMode="numeric" autoComplete={index===0?'one-time-code':'off'} pattern="[0-9]" maxLength={6} required value={digit} onFocus={event=>event.currentTarget.select()} onChange={event=>fill(event.target.value,index)} onPaste={event=>{event.preventDefault();fill(event.clipboardData.getData('text'),index)}} onKeyDown={event=>{
      if(event.key==='Backspace'){event.preventDefault();const target=digits[index]?index:Math.max(0,index-1);setDigits(previous=>previous.map((value,i)=>i===target?'':value));inputs.current[target]?.focus()}
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();inputs.current[Math.max(0,Math.min(5,index+(event.key==='ArrowLeft'?-1:1)))]?.focus()}
    }}/>)}</div>
    <input type="hidden" name={name} value={digits.join('')}/>
    <small id={`${id}-hint`}>Enter all six digits, or paste your code.</small>
  </div>
}
