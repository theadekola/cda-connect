import {useQuery} from '@tanstack/react-query';
import {Cloud,CloudSun,CloudMoon,CloudRain,CloudSnow,CloudLightning,CloudFog,Sun,Moon,MapPin} from 'lucide-react';
import {api} from './api';
import {Geolocation} from '@capacitor/geolocation';
import './home-weather.css';
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
class WeatherLocationError extends Error {}
export function HomeWeather(){
 // Weather uses device permission independently of the community location-sharing preference.
 // Obtain fresh coordinates on every refresh so weather follows the device when it moves.
 const query=useQuery({queryKey:['home-weather'],queryFn:async()=>{
  let position;try{position=(await Geolocation.getCurrentPosition({enableHighAccuracy:false,maximumAge:0,timeout:15000})).coords}catch{throw new WeatherLocationError('Allow location access in your device or browser settings to show local weather.')}
  return api.send<Weather>('/me/weather',{latitude:Number(position.latitude.toFixed(2)),longitude:Number(position.longitude.toFixed(2))});
 },staleTime:600000,gcTime:0,refetchInterval:600000,refetchIntervalInBackground:false,refetchOnWindowFocus:'always',refetchOnReconnect:'always',retry:false});
 const locationError=query.error instanceof WeatherLocationError,weather=locationError?undefined:query.data,condition=weather?weatherCondition(weather.code,weather.isDay):null,Icon=condition?.Icon||MapPin;
 const label=weather?`${condition!.label}, ${Math.round(weather.temperature)} degrees Celsius${weather.rainChance===null?'':`, ${weather.rainChance}% rain chance`}. ${query.isError?'Update failed. ':''}Refresh local weather`:locationError?'Allow device location, then tap to retry weather':query.isError?'Weather unavailable. Tap to retry':'Loading local weather';
 return <div className="home-weather"><button className="weather-summary" type="button" aria-label={label} title={label} disabled={query.isFetching} onClick={()=>void query.refetch()}>
 <span className={'weather-art weather-'+(condition?.kind||'unknown')} aria-hidden="true"><Icon size={30}/>{condition&&['rain','snow','storm'].includes(condition.kind)&&<span className="weather-particles"><i/><i/><i/></span>}</span>
 <span className="weather-reading" aria-live="polite">{weather?<><strong>{Math.round(weather.temperature)}°C</strong><small>{query.isError?'Update failed':weather.rainChance===null?'Rain —':`Rain ${weather.rainChance}%`}</small></>:<><strong>Weather</strong><small>{query.isFetching?'Loading…':locationError?'Allow location':'Tap to retry'}</small></>}</span>
 </button></div>
}
