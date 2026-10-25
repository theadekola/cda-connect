import {useEffect,useRef,type ReactNode,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
export function MemberDialog({children,onClose,label='Manage member',className=''}:{children:ReactNode;onClose:()=>void;label?:string;className?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current!,previous=document.activeElement;d.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{d.close();document.body.style.overflow=old;if(previous instanceof HTMLElement&&previous.isConnected)previous.focus()}},[]);
 function trap(event:KeyboardEvent<HTMLDialogElement>){
  if(event.key!=='Tab')return;
  const elements=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length&&!element.closest('[inert]'));
  const first=elements[0],last=elements.at(-1);
  if(!first){event.preventDefault();event.currentTarget.focus();return}
  if(event.shiftKey&&(document.activeElement===first||!elements.includes(document.activeElement as HTMLElement))){event.preventDefault();last!.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||!elements.includes(document.activeElement as HTMLElement))){event.preventDefault();first.focus()}
 }
 return createPortal(<dialog ref={ref} tabIndex={-1} className={'member-dialog '+className} aria-label={label} onKeyDown={trap} onCancel={event=>{event.preventDefault();onClose()}} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose()}}}>{children}</dialog>,document.body)
}
