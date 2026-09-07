import axios from 'axios';
import {useAuth} from '../store/auth';
import {secureSet} from './storage';

const apiBase=(import.meta.env.VITE_API_URL||import.meta.env.EXPO_PUBLIC_API_URL||'/api/v1').replace(/\/$/,'');
export const api=axios.create({baseURL:apiBase,timeout:15000});
let refreshRequest:Promise<string>|null=null;

function reachableMedia(value:unknown):unknown{
  if(typeof value==='string'){
    try{
      const url=new URL(value,window.location.origin),apiUrl=new URL(apiBase,window.location.origin);
      const localHost=['localhost','127.0.0.1','0.0.0.0','cda-connect'].includes(url.hostname.toLowerCase());
      if((localHost||url.pathname.startsWith('/uploads/'))&&apiUrl.hostname){url.protocol=apiUrl.protocol;url.hostname=apiUrl.hostname;url.port=apiUrl.port;return url.toString()}
    }catch{}
    return value;
  }
  if(Array.isArray(value))return value.map(reachableMedia);
  if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,reachableMedia(item)]));
  return value;
}

api.interceptors.request.use(config=>{
  const token=useAuth.getState().accessToken;
  if(token)config.headers.Authorization=`Bearer ${token}`;
  return config;
});

api.interceptors.response.use(response=>{response.data=reachableMedia(response.data);return response},async error=>{
  const original=error.config;
  if(error.response?.status!==401||!original||original._retry)return Promise.reject(error);
  original._retry=true;
  const refreshToken=useAuth.getState().refreshToken;
  if(!refreshToken){await useAuth.getState().logout();return Promise.reject(error)}
  try{
    refreshRequest??=axios.post(`${apiBase}/auth/refresh`,{refreshToken}).then(async response=>{const token=response.data.accessToken as string;useAuth.setState({accessToken:token});await secureSet('accessToken',token);return token}).finally(()=>{refreshRequest=null});
    const token=await refreshRequest;
    original.headers={...original.headers,Authorization:`Bearer ${token}`};
    return api(original);
  }catch(refreshError){
    await useAuth.getState().logout();
    if(typeof window!=='undefined'&&!window.location.pathname.includes('/login'))window.location.replace('/login');
    return Promise.reject(refreshError);
  }
});
