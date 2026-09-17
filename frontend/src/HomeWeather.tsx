import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import {Cloud,CloudSun,CloudMoon,CloudRain,CloudSnow,CloudLightning,CloudFog,Sun,Moon,MapPin,X,RefreshCw} from 'lucide-react';
import {api} from './api';
import {currentPosition} from './location';
import './home-weather.css';
type Position={latitude:number;longitude:number};
type Weather={temperature:number;code:number;isDay:boolean;rainChance:number|null;updatedAt:string};
export function weatherCondition(code:number,isDay:boolean){
 if(code===0)return {kind:isDay?'sun':'moon',label:isDay?'Clear skies':'Clear night',Icon:isDay?Sun:Moon};
 if(code===1||code===2)return {kind:'cloud',label:'Partly cloudy',Icon:isDay?CloudSun:CloudMoon};
 if(code===3)return {kind:'cloud',label:'Overcast',Icon:Cloud};
 if(code===45||code===48)return {kind:'fog',label:'Fog',Icon:CloudFog};
 if([71,73,75,77,85,86].includes(code))return {kind:'snow',label:'Snow',Icon:CloudSnow};
 if([95,96,99].includes(code))return {kind:'storm',label:'Thunderstorms',Icon:CloudLightning};
 if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return {kind:'rain',label:code<60?'Drizzle':'Rain',Icon:CloudRain};
 return {kind:'cloud',label:'Weather',Icon:Cloud};
}
export function HomeWeather(){
 const [position,setPosition]=useState<Position|null>(null),[locating,setLocating]=useState(false),[error,setError]=useState(''),dialog=useRef<HTMLDialogElement>(null);
 async function locate(){setLocating(true);setError('');try{const p=await currentPosition();setPosition({latitude:Number(p.latitude.toFixed(2)),longitude:Number(p.longitude.toFixed(2))})}catch{setError('Allow location access in your device or browser settings, then try again.')}finally{setLocating(false)}}
 useEffect(()=>{let active=true;void(async()=>{try{const allowed=Capacitor.isNativePlatform()?(await Geolocation.checkPermissions()).location==='granted':!!navigator.permissions&&(await navigator.permissions.query({name:'geolocation'})).state==='granted';if(active&&allowed)await locate()}catch{/* Ask only when the member taps Use location. */}})();return()=>{active=false}},[]);
 const query=useQuery({queryKey:['home-weather',position?.latitude,position?.longitude],enabled:!!position,queryFn:()=>api.send<Weather>('/me/weather',position),staleTime:600000,refetchInterval:600000,retry:1});
 const weather=query.data,condition=weather?weatherCondition(weather.code,weather.isDay):null,Icon=condition?.Icon||MapPin,busy=locating||(!!position&&query.isPending);
 function open(){dialog.current?.showModal()}
 return <div className="home-weather"><button className="weather-summary" type="button" aria-label={weather?`${condition!.label}, ${Math.round(weather.temperature)} degrees Celsius${weather.rainChance===null?'':`, ${weather.rainChance}% rain chance`}. Open weather details`:'Open local weather'} onClick={open}>
 <span className={'weather-art weather-'+(condition?.kind||'unknown')} aria-hidden="true"><Icon size={30}/>{condition&&['rain','snow','storm'].includes(condition.kind)&&<span className="weather-particles"><i/><i/><i/></span>}</span>
 <span className="weather-reading">{weather?<><strong>{Math.round(weather.temperature)}°C</strong><small>{query.isError?'Update failed':weather.rainChance===null?'Rain —':`Rain ${weather.rainChance}%`}</small></>:<><strong>Weather</strong><small>{busy?'Loading…':error||query.isError?'Tap to retry':'Use location'}</small></>}</span>
 </button><dialog ref={dialog} className="weather-dialog" aria-labelledby="weather-title"><header><h2 id="weather-title">Local weather</h2><button type="button" aria-label="Close weather" onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
 {weather&&<><p className="weather-details-temperature"><Icon aria-hidden="true"/> {Math.round(weather.temperature)}°C · {condition!.label}</p><p>Rain chance this hour: {weather.rainChance===null?'Unavailable':weather.rainChance+'%'}</p><p className="weather-updated">Near your device location · Updated {new Date(weather.updatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p></>}
 {!weather&&<p>Use your current location to show nearby weather. An approximate location is sent to Open-Meteo.</p>}
 {(error||query.isError)&&<p role="alert">{error||'Weather could not be updated. Please try again.'}</p>}
 <button type="button" disabled={busy||query.isFetching} onClick={()=>{if(position&&!error)void query.refetch();else void locate()}}><RefreshCw size={16}/>{busy||query.isFetching?'Loading…':position&&!error?'Refresh weather':'Use my location'}</button>
 {position&&<button type="button" disabled={locating} onClick={()=>void locate()}>Update location</button>}
 <small><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo</a> · Local estimates may differ from conditions at your exact position.</small>
 </dialog></div>
}
