import type {QueryClient,QueryKey} from '@tanstack/react-query';
import {observeMutations} from './api';
// Related visible resources refresh immediately; other cached data becomes stale
// and refreshes when revisited, without blocking the completed action.
export function relatedQuery(key:QueryKey,paths:string[]){
 const value=String(key[0]??'').split('?')[0];
 return paths.some(path=>{
  const segments=path.split('?')[0].split('/').filter(Boolean);
  const prefix='/'+segments.slice(0,segments[0]==='communities'?3:2).join('/');
  if(value===prefix||value.startsWith(prefix+'/')||prefix.startsWith(value+'/'))return true;
  if(segments[0]==='communities')return value==='/communities/'+segments[1]+'/capabilities'||value==='/home/recent-activity'||value.includes('/feed');
  if(segments[0]==='users')return value==='/users/me'||value==='/users/account';
  return value.includes('/feed')||value.includes('/recent-activity');
 });
}
export async function runMutation(client:QueryClient,run:()=>Promise<unknown>){
 const paths:string[]=[];const stop=observeMutations(path=>paths.push(path));
 try{return await run()}finally{stop();if(paths.length){void client.invalidateQueries({refetchType:'none'});void client.refetchQueries({type:'active',predicate:query=>relatedQuery(query.queryKey,paths)})}}
}
