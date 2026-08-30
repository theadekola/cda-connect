import { create } from 'zustand';
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';
import { secureDelete,secureGet,secureSet } from '../lib/storage';

type State={user:User|null;accessToken:string|null;refreshToken:string|null;hydrated:boolean;setSession:(u:User,a:string,r:string)=>Promise<void>;updateUser:(u:User)=>Promise<void>;load:()=>Promise<void>;logout:()=>Promise<void>};
export const useAuth=create<State>((set)=>({
  user:null,accessToken:null,refreshToken:null,hydrated:false,
  setSession:async(user,accessToken,refreshToken)=>{await Promise.all([secureSet('accessToken',accessToken),secureSet('refreshToken',refreshToken),secureSet('user',JSON.stringify(user))]);set({user,accessToken,refreshToken,hydrated:true});},
  updateUser:async user=>{await secureSet('user',JSON.stringify(user));set({user});},
  load:async()=>{try{const enabled=Platform.OS!=='web'&&await secureGet('biometric-login-enabled')==='true';if(enabled){const proof=await SecureStore.getItemAsync('biometric-login-proof',{requireAuthentication:true,authenticationPrompt:'Unlock CDA Connect'});if(!proof)return set({user:null,accessToken:null,refreshToken:null,hydrated:true})}const [a,r,u]=await Promise.all([secureGet('accessToken'),secureGet('refreshToken'),secureGet('user')]);set({accessToken:a,refreshToken:r,user:u?JSON.parse(u):null,hydrated:true})}catch{set({user:null,accessToken:null,refreshToken:null,hydrated:true})}},
  logout:async()=>{await Promise.all([secureDelete('accessToken'),secureDelete('refreshToken'),secureDelete('user'),secureDelete('biometric-login-enabled'),Platform.OS==='web'?Promise.resolve():SecureStore.deleteItemAsync('biometric-login-proof')]);set({user:null,accessToken:null,refreshToken:null,hydrated:true});}
}));
