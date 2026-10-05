import {readFile} from 'node:fs/promises';
import {AppError} from '../utils/errors.js';
type Country={name:string;states:Record<string,{name:string;areas:string[]}>};
let data:Promise<Record<string,Country>>|undefined;
export function locations():Promise<Record<string,Country>>{return data??=readFile(new URL('../../data/community-locations.json',import.meta.url),'utf8').then(text=>JSON.parse(text) as Record<string,Country>).catch(e=>{data=undefined;throw e})}
export async function countryCodeForCountry(country:string){const normalized=country.trim().toLocaleLowerCase(),code=Object.entries(await locations()).find(([id,item])=>id.toLocaleLowerCase()===normalized||item.name.toLocaleLowerCase()===normalized)?.[0];if(!code)throw new AppError(400,'Add a valid country to your account before creating a community');return code}
export async function selectedLocation(countryCode:string,stateId:string,area:string){
 const c=(await locations())[countryCode];if(!c)throw new AppError(400,'Select a valid country');
 const states=Object.keys(c.states),s=c.states[stateId];
 if((states.length||stateId)&&!s)throw new AppError(400,'Select a state or region in your country');
 if(s?.areas.length&&!s.areas.includes(area))throw new AppError(400,'Select a local area in your state or region');
 if(!s?.areas.length&&area)throw new AppError(400,'No local area is available for this region');
 return{country:c.name,state:s?.name??'',lga:countryCode==='NG'?area:'',city:area||s?.name||c.name};
}

