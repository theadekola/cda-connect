import {Preferences} from '@capacitor/preferences';
export async function getItemAsync(key:string,_options?:any){return (await Preferences.get({key})).value}
export async function setItemAsync(key:string,value:string,_options?:any){await Preferences.set({key,value})}
export async function deleteItemAsync(key:string,_options?:any){await Preferences.remove({key})}
