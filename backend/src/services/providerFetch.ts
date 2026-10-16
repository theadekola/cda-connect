import {AppError} from '../utils/errors.js';
export async function providerFetch(url:string,options:RequestInit){
 try{return await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)})}
 catch(error){throw new AppError(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?504:502,'AI or language provider is unavailable. Try again shortly.')}
}
