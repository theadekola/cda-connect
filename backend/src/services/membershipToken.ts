export function membershipToken(payload:string){
 if(/^CDACONNECT:[A-Za-z0-9_-]{32}$/.test(payload))return payload.slice(11);
 try{const url=new URL(payload);if(url.origin==='https://cdaconnect.org'&&/^\/community\/[a-f0-9-]{36}\/membership-card$/.test(url.pathname)){const token=new URLSearchParams(url.hash.slice(1)).get('member');if(token&&/^[A-Za-z0-9_-]{32}$/.test(token))return token}}catch{}
 return null;
}
