export const documentDirectory='';export const cacheDirectory='';
export async function getInfoAsync(_uri?:string,_options?:any){return {exists:false,size:0,isDirectory:false}}
export async function deleteAsync(_uri?:string,_options?:any){}
export async function readDirectoryAsync(_uri?:string){return [] as string[]}
export async function makeDirectoryAsync(_uri?:string,_options?:any){}
export async function downloadAsync(uri:string){return {uri}}
export async function getTotalDiskCapacityAsync(_options?:any){return 0}
export async function getFreeDiskStorageAsync(_options?:any){return 0}
