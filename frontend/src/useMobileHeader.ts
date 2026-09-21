import {useEffect,useState} from 'react';

// Content moving up hides the mobile header; reversing the scroll reveals it.
export function useMobileHeader(route:string,menuOpen:boolean){
 const[hidden,setHidden]=useState(false),[scrolled,setScrolled]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(max-width:767px)');let last=window.scrollY,travel=0,direction=0;
  setHidden(false);setScrolled(false);
  const reset=()=>{last=window.scrollY;travel=0;direction=0;setHidden(false);setScrolled(media.matches&&last>32)};
  const scroll=(event:Event)=>{
   const target=event.target;
   if(target!==document&&target!==window&&!(target instanceof HTMLElement&&(target.id==='main'||target.classList.contains('workspace'))))return;
   const y=Math.max(0,target instanceof HTMLElement?target.scrollTop:window.scrollY),delta=y-last;last=y;
   if(!media.matches){setHidden(false);setScrolled(false);return}
   setScrolled(y>32);
   const header=document.querySelector('.workspace>.topbar');
   const editing=header?.querySelector('input:focus,textarea:focus,select:focus,details[open]');
   if(menuOpen||editing||y<32){travel=0;setHidden(false);return}
   if(Math.abs(delta)<1)return;
   const next=Math.sign(delta);travel=next===direction?travel+Math.abs(delta):Math.abs(delta);direction=next;
   if(travel>=12){setHidden(next>0&&y>(header?.getBoundingClientRect().height??64));travel=0}
  };
  document.addEventListener('scroll',scroll,{capture:true,passive:true});media.addEventListener('change',reset);
  return()=>{document.removeEventListener('scroll',scroll,true);media.removeEventListener('change',reset)};
 },[route,menuOpen]);
 return {hidden,scrolled};
}
