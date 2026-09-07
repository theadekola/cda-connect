import React,{Suspense,createContext,useContext,useEffect,useMemo} from 'react';
import {Navigate,useLocation,useNavigate} from 'react-router-dom';

type Target=string|{pathname:string;params?:Record<string,unknown>};
type Module={default:React.ComponentType};

const pages=import.meta.glob<Module>('../app/**/*.tsx');
let navigateFn:ReturnType<typeof useNavigate>|null=null;
const RouteParamsContext=createContext<Record<string,string>>({});

function cleanPath(path:string){
  const withoutGroups=path.replace(/\/(?:\([^/]+\))/g,'');
  return withoutGroups.replace(/\/+/g,'/')||'/';
}

function targetUrl(target:Target){
  if(typeof target==='string')return cleanPath(target);
  const query=new URLSearchParams();
  Object.entries(target.params||{}).forEach(([key,value])=>{if(value!==undefined&&value!==null)query.set(key,String(value))});
  return `${cleanPath(target.pathname)}${query.size?`?${query}`:''}`;
}

function go(target:Target,replace=false){
  const url=targetUrl(target);
  if(navigateFn)navigateFn(url,{replace});
  else window.location.assign(url);
}

export const router={
  push:(target:Target)=>go(target),
  replace:(target:Target)=>go(target,true),
  back:()=>navigateFn?navigateFn(-1):history.back(),
  canGoBack:()=>history.length>1,
  setParams:(params:Record<string,unknown>)=>{
    const query=new URLSearchParams(location.search);
    Object.entries(params).forEach(([key,value])=>value===undefined||value===null?query.delete(key):query.set(key,String(value)));
    go(`${location.pathname}${query.size?`?${query}`:''}`,true);
  },
};

function routeFromFile(file:string){
  let path=file.replace('../app','').replace(/\.tsx$/,'').replace(/\/index$/,'');
  path=path.replace(/\/\([^/]+\)/g,'').replace(/\[([^\]]+)\]/g,':$1');
  return path||'/';
}

const routeEntries=Object.entries(pages)
  .filter(([file])=>!file.endsWith('/_layout.tsx'))
  .map(([file,load])=>{
    const template=routeFromFile(file);
    const names:string[]=[];
    const expression=template==='/'?/^\/$/:new RegExp(`^${template.replace(/:[^/]+/g,value=>{names.push(value.slice(1));return '([^/]+)'})}/?$`);
    return {template,names,expression,load,score:template.split('/').reduce((sum,part)=>sum+(part.startsWith(':')?1:3),0)};
  })
  .sort((a,b)=>b.score-a.score);

function RouteView(){
  const location=useLocation();
  const navigate=useNavigate();
  navigateFn=navigate;
  const match=routeEntries.find(route=>route.expression.test(location.pathname));
  const Lazy=useMemo(()=>match?React.lazy(match.load):null,[match?.template]);
  if(location.pathname==='/')return <Navigate to="/welcome" replace/>;
  if(!match)return <main style={{padding:32,fontFamily:'system-ui'}}><h1>Page not found</h1><button onClick={()=>router.replace('/')}>Return home</button></main>;
  if(!Lazy)return null;
  const values=match.expression.exec(location.pathname)?.slice(1)||[];
  const params=Object.fromEntries(match.names.map((name,index)=>[name,decodeURIComponent(values[index]||'')]));
  return <RouteParamsContext.Provider value={params}><Suspense fallback={<div role="status" style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#EEF3F8',fontFamily:'system-ui',fontWeight:700}}>Loading CDA Connect…</div>}><Lazy/></Suspense></RouteParamsContext.Provider>;
}

const Navigator=(_props:any)=> <RouteView/>;
const Screen=(_props:any)=>null;
export const Stack=Object.assign(Navigator,{Screen});
export const Tabs=Object.assign(Navigator,{Screen});

export function Redirect({href}:{href:Target}){return <Navigate to={targetUrl(href)} replace/>}
export function useRouter(){useNavigate();return router}
export function usePathname(){return useLocation().pathname}
export function useLocalSearchParams<T extends Record<string,unknown>=Record<string,string>>(){
  const path=useContext(RouteParamsContext);const{search}=useLocation();
  return useMemo(()=>({...Object.fromEntries(new URLSearchParams(search)),...path}) as T,[path,search]);
}
export function useFocusEffect(effect:()=>void|(()=>void)){useEffect(effect,[effect])}
