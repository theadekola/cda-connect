import {z} from 'zod';
import {AppError} from '../utils/errors.js';
import {env} from '../config/env.js';
export const weatherLocation=z.object({latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)});
const responseSchema=z.object({current:z.object({time:z.number(),temperature_2m:z.number().finite(),weather_code:z.number().int(),is_day:z.union([z.literal(0),z.literal(1)])}),hourly:z.object({time:z.array(z.number()),precipitation_probability:z.array(z.number().min(0).max(100).nullable())})});
type Weather={temperature:number;code:number;isDay:boolean;rainChance:number|null;updatedAt:string};
const cache=new Map<string,{expires:number;data:Weather}>();
export async function localWeather(input:unknown):Promise<Weather>{
 const position=weatherLocation.parse(input),latitude=Number(position.latitude.toFixed(2)),longitude=Number(position.longitude.toFixed(2)),key=latitude+','+longitude,hit=cache.get(key);
 if(hit&&hit.expires>Date.now())return hit.data;
 const url=new URL(env.OPEN_METEO_API_KEY?'https://customer-api.open-meteo.com/v1/forecast':'https://api.open-meteo.com/v1/forecast');
 url.search=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),current:'temperature_2m,weather_code,is_day',hourly:'precipitation_probability',forecast_days:'2',timeformat:'unixtime',timezone:'UTC',temperature_unit:'celsius'}).toString();
 if(env.OPEN_METEO_API_KEY)url.searchParams.set('apikey',env.OPEN_METEO_API_KEY);
 try{
  const result=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!result.ok)throw Error('Provider unavailable');
  const parsed=responseSchema.parse(await result.json()),current=parsed.current;
  if(Math.abs(Date.now()/1000-current.time)>7200)throw Error('Outdated weather');
  const index=parsed.hourly.time.findIndex(t=>t-3600<=current.time&&current.time<t);
  const data={temperature:current.temperature_2m,code:current.weather_code,isDay:current.is_day===1,rainChance:index<0?null:parsed.hourly.precipitation_probability[index]??null,updatedAt:new Date(current.time*1000).toISOString()};
  if(cache.size>=256)cache.delete(cache.keys().next().value!);
  cache.set(key,{expires:Date.now()+600000,data});return data;
 }catch{throw new AppError(503,'Weather is temporarily unavailable. Please try again.');}
}
