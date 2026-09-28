import {readFile} from 'node:fs/promises';
import {locations} from './communityLocations.js';
import {AppError} from '../utils/errors.js';

let data:Promise<Record<string,string>>|undefined;
function currencies(){return data??=readFile(new URL('../../data/country-currencies.json',import.meta.url),'utf8').then(text=>JSON.parse(text) as Record<string,string>).catch(error=>{data=undefined;throw error})}

export async function currencyForCountryCode(countryCode:string){
 const currency=(await currencies())[countryCode.trim().toUpperCase()];
 if(!currency||!/^[A-Z]{3}$/.test(currency))throw new AppError(400,'The community country does not have a supported currency');
 return currency;
}

export async function currencyForCountry(country:string){
 const normalized=country.trim().toLocaleLowerCase(),all=await locations(),countryCode=Object.entries(all).find(([code,item])=>code.toLocaleLowerCase()===normalized||item.name.toLocaleLowerCase()===normalized)?.[0];
 if(!countryCode)throw new AppError(400,'Set a valid community country before configuring finance');
 return currencyForCountryCode(countryCode);
}