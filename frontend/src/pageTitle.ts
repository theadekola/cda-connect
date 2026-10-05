import {createContext} from 'react';

export const HeaderTitleContext=createContext<string|null>(null);
export function duplicatesHeader(title:string,header:string|null){
 if(!header)return false;
 const normalize=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ').replace(/^(my |cda connect )/,'').replace(/^(create|join) a /,'$1 ');
 return normalize(title)===normalize(header);
}
