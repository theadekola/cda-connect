export type MediaPolicy='WIFI'|'ALWAYS'|'NEVER';
export type StoragePreferences={dataSaver:boolean;syncMobile:boolean;photos:MediaPolicy;videos:MediaPolicy;documents:MediaPolicy;audio:MediaPolicy};
export const storageDefaults:StoragePreferences={dataSaver:false,syncMobile:true,photos:'WIFI',videos:'NEVER',documents:'WIFI',audio:'ALWAYS'};
export function canLoadMedia(p:StoragePreferences,kind:'photos'|'videos'|'documents'|'audio',connection:string){return !p.dataSaver&&(p[kind]==='ALWAYS'||p[kind]==='WIFI'&&(connection==='wifi'||connection==='ethernet'))}
export function canRefresh(p:StoragePreferences,connection:string){return p.syncMobile||connection==='wifi'||connection==='ethernet'}
