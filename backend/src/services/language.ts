import { env } from '../config/env.js';
import {providerFetch} from './providerFetch.js';
import { AppError } from '../utils/errors.js';
export const translationAvailable=()=>!!(env.GOOGLE_TRANSLATE_API_KEY?.trim()||env.LANGUAGE_SERVICE_URL?.trim());
function checkedText(value:unknown){
 if(typeof value!=='string'||!value.trim()||value.length>50000)throw new AppError(502,'Translation service returned no text');
 return value;
}
function decodeTranslation(text:string){
 const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
 return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(match,key:string)=>{
  if(key[0]!=='#')return entities[key.toLowerCase()]??match;
  const value=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
  return Number.isInteger(value)&&value>=0&&value<=0x10ffff&&!(value>=0xd800&&value<=0xdfff)?String.fromCodePoint(value):match;
 });
}
async function googleTranslate(text:string,language:string){
 const target=language==='en-GB'||language==='en-US'?'en':language;
 if(!['en','fr','es','ar','ha','yo','ig','pt','de'].includes(target))throw new AppError(400,'Unsupported translation language');
 const response=await providerFetch('https://translation.googleapis.com/language/translate/v2',{
  method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GOOGLE_TRANSLATE_API_KEY!},
  body:JSON.stringify({q:text,target,format:'text',model:'nmt'})
 });
 // Never return a provider error body: it can contain keys or private source text.
 if(!response.ok)throw new AppError(response.status===429?503:502,response.status===429?'Translation limit reached. Try again later.':'Translation service failed. Check the server provider configuration.');
 let data:any;try{data=await response.json()}catch{throw new AppError(502,'Translation service returned an invalid response')}
 return decodeTranslation(checkedText(data?.data?.translations?.[0]?.translatedText));
}
export async function transformText(text:string,mode:'translate'|'simple',language:string){
 if(mode==='translate'&&env.GOOGLE_TRANSLATE_API_KEY?.trim())return googleTranslate(text,language);
 if(!env.LANGUAGE_SERVICE_URL) throw new AppError(503,'Language service is not configured');
 const r=await providerFetch(env.LANGUAGE_SERVICE_URL,{method:'POST',headers:{'content-type':'application/json',...(env.LANGUAGE_SERVICE_API_KEY?{authorization:`Bearer ${env.LANGUAGE_SERVICE_API_KEY}`}:{})},body:JSON.stringify({task:mode,text,targetLanguage:language})});
 if(!r.ok) throw new AppError(502,'Language service failed'); let data:any;try{data=await r.json()}catch{throw new AppError(502,'Translation service returned an invalid response')}  const result=data?.text??data?.translation??data?.result;if(typeof result!=='string'||!result.trim()||result.length>50000)throw new AppError(502,'Translation service returned no text');return result;
}
