import {useEffect,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export function MobileHeaderActions({children}:{children:ReactNode}){
 const [target,setTarget]=useState<Element|null>(null);
 useEffect(()=>{const media=window.matchMedia('(max-width:767px)');const update=()=>setTarget(media.matches?document.querySelector('.workspace>.topbar .top-actions'):null);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 return target?createPortal(<div className="cover-header-actions">{children}</div>,target):<>{children}</>;
}
