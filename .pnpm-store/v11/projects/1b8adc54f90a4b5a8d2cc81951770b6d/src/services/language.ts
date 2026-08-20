import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
export async function transformText(text:string,mode:'translate'|'simple',language:string){
 if(!env.LANGUAGE_SERVICE_URL) throw new AppError(503,'Language service is not configured');
 const r=await fetch(env.LANGUAGE_SERVICE_URL,{method:'POST',headers:{'content-type':'application/json',...(env.LANGUAGE_SERVICE_API_KEY?{authorization:`Bearer ${env.LANGUAGE_SERVICE_API_KEY}`}:{})},body:JSON.stringify({task:mode,text,targetLanguage:language})});
 if(!r.ok) throw new AppError(502,'Language service failed'); const data:any=await r.json(); return String(data.text??data.translation??data.result??'');
}
