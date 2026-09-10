import {useCallback,useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

// Refresh server data without reloading the document or clearing unfinished forms.
export function useAppRefresh(route:string){
 const queryClient=useQueryClient(),surface=useRef<HTMLElement>(null),running=useRef(false);
 const[refreshing,setRefreshing]=useState(false),[distance,setDistance]=useState(0),[message,setMessage]=useState('');
 const refresh=useCallback(async()=>{
  if(running.current)return;
  if(!navigator.onLine){setMessage('You are offline. Reconnect and try refreshing again.');return}
  if(queryClient.isMutating()){setMessage('Wait for your current changes to finish, then refresh.');return}
  running.current=true;setRefreshing(true);setMessage('Refreshing…');
  try{await queryClient.invalidateQueries({refetchType:'active'},{throwOnError:true});setMessage('Up to date.')}
  catch{setMessage('Refresh failed. Check your connection and try again.')}
  finally{running.current=false;setRefreshing(false)}
 },[queryClient]);
 useEffect(()=>{
  const el=surface.current;if(!el)return;
  let start:{x:number;y:number}|null=null,pull=0;
  const reset=()=>{start=null;pull=0;setDistance(0)};
  const begin=(event:TouchEvent)=>{
   reset();if(running.current||event.touches.length!==1||window.scrollY>1||el.scrollTop>1)return;
   const target=event.target instanceof Element?event.target:null;
   if(!target||target.closest('input,textarea,select,button,a,[contenteditable],[role="dialog"],[role="slider"]'))return;
   // Leave nested scrolling panels, chat history and dialogs to their own gestures.
   for(let node:Element|null=target;node&&node!==el;node=node.parentElement){
    const style=getComputedStyle(node);
    if(/auto|scroll/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1)return;
   }
   start={x:event.touches[0].clientX,y:event.touches[0].clientY};setMessage('');
  };
  const move=(event:TouchEvent)=>{
   if(!start)return;
   if(event.touches.length!==1){reset();return}
   const dx=event.touches[0].clientX-start.x,dy=event.touches[0].clientY-start.y;
   if(dy<0||Math.abs(dx)>Math.max(12,Math.abs(dy))){reset();return}
   if(dy<8)return;
   if(!event.cancelable){reset();return}
   event.preventDefault();pull=dy;setDistance(Math.min(72,dy/2));
  };
  const end=()=>{const trigger=pull>=96;reset();if(trigger)void refresh()};
  document.documentElement.classList.add('app-pull-refresh');
  el.addEventListener('touchstart',begin,{passive:true});
  el.addEventListener('touchmove',move,{passive:false});
  el.addEventListener('touchend',end);el.addEventListener('touchcancel',reset);
  return()=>{document.documentElement.classList.remove('app-pull-refresh');el.removeEventListener('touchstart',begin);el.removeEventListener('touchmove',move);el.removeEventListener('touchend',end);el.removeEventListener('touchcancel',reset);reset()};
 },[route,refresh]);
 return{surface,refresh,refreshing,distance,message};
}
