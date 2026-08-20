import { create } from 'zustand';
import type { User } from '../types';
import { secureDelete,secureGet,secureSet } from '../lib/storage';

type State={user:User|null;accessToken:string|null;refreshToken:string|null;hydrated:boolean;setSession:(u:User,a:string,r:string)=>Promise<void>;load:()=>Promise<void>;logout:()=>Promise<void>};
export const useAuth=create<State>((set)=>({
  user:null,accessToken:null,refreshToken:null,hydrated:false,
  setSession:async(user,accessToken,refreshToken)=>{await Promise.all([secureSet('accessToken',accessToken),secureSet('refreshToken',refreshToken),secureSet('user',JSON.stringify(user))]);set({user,accessToken,refreshToken,hydrated:true});},
  load:async()=>{const [a,r,u]=await Promise.all([secureGet('accessToken'),secureGet('refreshToken'),secureGet('user')]);set({accessToken:a,refreshToken:r,user:u?JSON.parse(u):null,hydrated:true});},
  logout:async()=>{await Promise.all([secureDelete('accessToken'),secureDelete('refreshToken'),secureDelete('user')]);set({user:null,accessToken:null,refreshToken:null,hydrated:true});}
}));
