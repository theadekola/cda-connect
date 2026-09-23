// Resolve server media against the API, never the native WebView's local origin.
export function resolveAssetUrl(value:string,apiBase:string,appOrigin:string){
 if(!value)return '';
 try{
  const url=new URL(value,appOrigin),apiUrl=new URL(apiBase,appOrigin);
  if(url.pathname.startsWith('/uploads/')||['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname))return new URL(url.pathname+url.search+url.hash,apiUrl.origin).href;
  return url.href;
 }catch{return value}
}
