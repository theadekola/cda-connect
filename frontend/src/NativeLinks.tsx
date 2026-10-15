import {useEffect,useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {App} from '@capacitor/app';
import {Capacitor,type PluginListenerHandle} from '@capacitor/core';
import {nativeLinkPath} from './navigation';

export function NativeLinks(){
 const navigate=useNavigate(),navigation=useRef(navigate);navigation.current=navigate;
 useEffect(()=>{
  if(!Capacitor.isNativePlatform())return;
  let disposed=false,handle:PluginListenerHandle|undefined,last='',receivedEvent=false;
  const open=(url?:string)=>{const path=nativeLinkPath(url||'');if(!disposed&&path&&path!==last){last=path;navigation.current(path)}};
  void(async()=>{
   const listener=await App.addListener('appUrlOpen',event=>{receivedEvent=true;last='';open(event.url)});
   if(disposed){await listener.remove();return}handle=listener;
   const launch=await App.getLaunchUrl();if(!receivedEvent)open(launch?.url);
  })().catch(()=>{});
  return()=>{disposed=true;void handle?.remove()};
 },[]);
 return null;
}
