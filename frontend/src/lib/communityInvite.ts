import {api} from './api';
import {secureDelete,secureGet,secureSet} from './storage';

const pendingInviteKey='pendingCommunityInviteCode';
export const normalizeInviteCode=(value:string)=>value.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,20);
export const savePendingCommunityInvite=(code:string)=>secureSet(pendingInviteKey,normalizeInviteCode(code));
export async function completePendingCommunityInvite(){
  const code=await secureGet(pendingInviteKey);
  if(!code)return null;
  const response=await api.post('/communities/join',{joinCode:code});
  await secureDelete(pendingInviteKey);
  return response.data as {Id:string;Name:string};
}
