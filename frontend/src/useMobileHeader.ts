import {useEffect,useState} from 'react';

// Keep navigation visible; scrolling only changes the cover header's background.
export function useMobileHeader(route:string,menuOpen:boolean){
 const[scrolled,setScrolled]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(max-width:767px)');
  const update=()=>setScrolled(media.matches&&window.scrollY>32);
  update();window.addEventListener('scroll',update,{passive:true});media.addEventListener('change',update);
  return()=>{window.removeEventListener('scroll',update);media.removeEventListener('change',update)};
 },[route,menuOpen]);
 return {hidden:false,scrolled};
}
