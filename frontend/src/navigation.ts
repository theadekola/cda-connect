// Only app routes may survive sign-in or arrive from an external link.
export function safeReturnPath(value:string){
 if(!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020]/.test(value))return '';
 try{
  const decoded=decodeURIComponent(value);
  if(/[\\\u0000-\u001f]/.test(decoded)||decoded.startsWith('//')||/(^|\/)\.{1,2}(\/|$)/.test(decoded.split(/[?#]/)[0]))return '';
  const url=new URL(value,'https://cdaconnect.org');
  if(!/^\/(?:home|communities|community|post|poll|chat|notifications|ai|profile|member|settings|invite)(?:\/|$)/.test(url.pathname))return '';
  return url.pathname+url.search+url.hash;
 }catch{return ''}
}
export function nativeLinkPath(value:string){
 try{
  const url=new URL(value);
  if(url.username||url.password)return '';
  if(url.protocol==='https:'&&url.hostname==='cdaconnect.org'&&!url.port)return safeReturnPath(url.pathname+url.search+url.hash);
  if(url.protocol==='org.cdaconnect.app:'&&url.hostname==='open')return safeReturnPath(url.pathname+url.search+url.hash);
 }catch{}
 return '';
}
