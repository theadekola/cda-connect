const KEY='cda-last-activity';
export const IDLE_TIMEOUT_MS=30*60*1000;
export function sessionIdle(lastActivity:number,now=Date.now()){return now-lastActivity>=IDLE_TIMEOUT_MS}
// Activity survives background suspension and reloads. No credentials are stored here.
export function watchSessionActivity(expire:()=>void,expiresAt?:string){
 let last=Date.now(),ended=false;
 try{const saved=Number(localStorage.getItem(KEY));if(saved>0)last=saved}catch{}
 const check=()=>{if(!ended&&(sessionIdle(last)||(expiresAt!==undefined&&Date.now()>=Date.parse(expiresAt)))){ended=true;expire()}return ended};
 const activity=()=>{if(check())return;last=Date.now();try{localStorage.setItem(KEY,String(last))}catch{}};
 const storage=(event:StorageEvent)=>{if(event.key===KEY&&event.newValue){const value=Number(event.newValue);if(Number.isFinite(value)&&value>last)last=value}};
 const events=['pointerdown','keydown','touchstart'] as const;
 events.forEach(event=>window.addEventListener(event,activity,{passive:true}));
 window.addEventListener('storage',storage);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
 const timer=window.setInterval(check,15000);check();
 return()=>{clearInterval(timer);events.forEach(event=>window.removeEventListener(event,activity));window.removeEventListener('storage',storage);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)};
}
export function resetSessionActivity(){try{localStorage.setItem(KEY,String(Date.now()))}catch{}}
