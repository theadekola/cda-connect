import {useEffect,useRef,type ReactNode,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {session} from './api';
import {biometricLock} from './sessionSecurity';
const focusSelector='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
export function MemberDialog({children,onClose,label='Manage member',className=''}:{children:ReactNode;onClose:()=>void;label?:string;className?:string}){
 const ref=useRef<HTMLElement|null>(null),close=useRef(onClose);close.current=onClose;
 const native=typeof HTMLDialogElement!=='undefined'&&typeof HTMLDialogElement.prototype.showModal==='function';
 useEffect(()=>{
  const d=ref.current!,previous=document.activeElement,owner=session.get()?.user.Id,old=document.body.style.overflow;
  const dismiss=()=>{if(native)(d as HTMLDialogElement).close();d.hidden=true;close.current()};
  if(biometricLock.get()||!owner){dismiss();return}
  const background=!native?Array.from(document.body.children).filter(element=>!element.contains(d)).map(element=>({element,aria:element.getAttribute('aria-hidden')})):[];
  if(native)(d as HTMLDialogElement).showModal();else{background.forEach(({element})=>element.setAttribute('aria-hidden','true'));d.focus()}
  document.body.style.overflow='hidden';
  const stopLock=biometricLock.subscribe(()=>{if(biometricLock.get())dismiss()});
  const stopSession=session.subscribe(()=>{if(session.get()?.user.Id!==owner)dismiss()});
  const visibility=()=>{if(document.visibilityState==='hidden')dismiss()};
  const keepFocus=(event:FocusEvent)=>{if(!native&&!d.hidden&&event.target instanceof Node&&!d.contains(event.target))d.focus()};
  document.addEventListener('visibilitychange',visibility);document.addEventListener('focusin',keepFocus);
  return()=>{stopLock();stopSession();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('focusin',keepFocus);if(native)(d as HTMLDialogElement).close();document.body.style.overflow=old;background.forEach(({element,aria})=>{if(aria===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',aria)});if(!biometricLock.get()&&session.get()?.user.Id===owner&&previous instanceof HTMLElement&&previous.isConnected)previous.focus()};
 },[native]);
 function trap(event:KeyboardEvent<HTMLElement>){
  if(event.key==='Escape'&&!native){event.preventDefault();close.current();return}
  if(event.key!=='Tab')return;
  const elements=Array.from(event.currentTarget.querySelectorAll<HTMLElement>(focusSelector)).filter(element=>element.getClientRects().length&&!element.closest('[inert]'));
  const first=elements[0],last=elements[elements.length-1];
  if(!first){event.preventDefault();event.currentTarget.focus();return}
  if(event.shiftKey&&(document.activeElement===first||!elements.includes(document.activeElement as HTMLElement))){event.preventDefault();last!.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||!elements.includes(document.activeElement as HTMLElement))){event.preventDefault();first.focus()}
 }
 const shared={tabIndex:-1,className:'member-dialog '+className,'aria-label':label,onKeyDown:trap};
 return createPortal(native?<dialog {...shared} ref={element=>{ref.current=element}} onCancel={event=>{event.preventDefault();close.current()}} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close.current()}}}>{children}</dialog>:<div className="member-dialog-fallback" onClick={event=>{if(event.target===event.currentTarget)close.current()}}><section {...shared} ref={element=>{ref.current=element}} role="dialog" aria-modal="true">{children}</section></div>,document.body)
}
